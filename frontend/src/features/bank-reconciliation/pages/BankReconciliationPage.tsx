import type {
  AggregatedTransactionListItem,
  AggregatedTransactionFilterParams,
} from "@/features/pos-aggregates/types";
import { posAggregatesApi } from "@/features/pos-aggregates/api/posAggregates.api";
import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  LayoutGrid,
  X,
  Filter,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { BankMutationTable } from "../components/reconciliation/BankMutationTable";
import { ManualMatchModal } from "../components/reconciliation/ManualMatchModal";
import { AutoMatchDialog } from "../components/reconciliation/AutoMatchDialog";
import { MultiMatchModal } from "../components/reconciliation/MultiMatchModal";
import { MultiMatchGroupList } from "../components/reconciliation/MultiMatchGroupList";
import { BankReconciliationFilters, type BankStatementFilter } from "../components/BankReconciliationFilters";
import { useBankReconciliation } from "../hooks/useBankReconciliation";
import type {
  BankStatementWithMatch,
  MatchingCriteria,
} from "../types/bank-reconciliation.types";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Type definitions for better type safety
type DateRange = {
  startDate: string;
  endDate: string;
};

export function BankReconciliationPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isAutoMatchOpen, setIsAutoMatchOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<BankStatementWithMatch | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isMultiMatchModalOpen, setIsMultiMatchModalOpen] = useState(false);
  const [multiMatchSelectedStatements, setMultiMatchSelectedStatements] = useState<BankStatementWithMatch[]>([]);
  const [selectedAggregateForMultiMatch, setSelectedAggregateForMultiMatch] = useState<AggregatedTransactionListItem | null>(null);
  const [showGroupList, setShowGroupList] = useState(true);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: '',
    endDate: '',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    statements,
    bankAccounts,
    isLoading,
    fetchStatementsWithFilters,
    fetchAllBankAccounts,
    previewAutoMatch,
    confirmAutoMatch,
    manualReconcile,
    undoReconciliation,
    fetchPotentialMatches,
    potentialMatchesMap,
    isLoadingMatches,
    filter,
    setFilter,
    clearFilter,
    reconciliationGroups,
    reconciliationGroupsError,
    fetchReconciliationGroups,
    createMultiMatch,
    undoMultiMatch,
  } = useBankReconciliation();

  // Fetch all bank accounts on mount
  useEffect(() => {
    fetchAllBankAccounts();
  }, [fetchAllBankAccounts]);

  // Set initial selected account (without auto-apply filters)
  useEffect(() => {
    if (!selectedAccountId && bankAccounts.length > 0) {
      const timeoutId = setTimeout(() => {
        setSelectedAccountId(bankAccounts[0].id);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [bankAccounts, selectedAccountId]);

  const handleApplyFilters = useCallback((filters: BankStatementFilter) => {
    setFilter(filters);
    setFiltersApplied(true);
    setError(null);

    if (filters.startDate || filters.endDate) {
      setDateRange({
        startDate: filters.startDate || '',
        endDate: filters.endDate || '',
      });
    }

    fetchStatementsWithFilters(filters);

    if (filters.startDate && filters.endDate) {
      fetchReconciliationGroups(filters.startDate, filters.endDate);
    }
  }, [setFilter, fetchStatementsWithFilters, fetchReconciliationGroups]);

  const handleClearFilters = useCallback(() => {
    clearFilter();
    setFiltersApplied(false);
    setDateRange({ startDate: '', endDate: '' });
    setError(null);
  }, [clearFilter]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const currentFilter = {
        ...filter,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        bankAccountIds: selectedAccountId ? [selectedAccountId] : undefined,
      };
      
      await fetchStatementsWithFilters(currentFilter);
      
      if (dateRange.startDate && dateRange.endDate) {
        await fetchReconciliationGroups(dateRange.startDate, dateRange.endDate);
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
      setError('Gagal memuat data terbaru. Silakan coba lagi.');
    } finally {
      setIsRefreshing(false);
    }
  }, [filter, dateRange.startDate, dateRange.endDate, selectedAccountId, fetchStatementsWithFilters, fetchReconciliationGroups]);

  // Memoize unreconciled statements to avoid unnecessary re-computation
  const unreconciledStatements = useMemo(() => {
    return statements.filter((s) => !s.is_reconciled);
  }, [statements]);

  const handleAutoMatchPreview = async () => {
    setIsLoadingPreview(true);
    setError(null);
    
    if (!dateRange.startDate || !dateRange.endDate) {
      setError("Silakan pilih rentang tanggal terlebih dahulu");
      setIsLoadingPreview(false);
      return;
    }
    
    setIsAutoMatchOpen(true);
    setIsLoadingPreview(false);
  };

  const handleAutoMatchPreviewApi = async (criteria?: Partial<MatchingCriteria>) => {
    if (!dateRange.startDate || !dateRange.endDate) {
      throw new Error("Silakan pilih rentang tanggal terlebih dahulu");
    }
    
    return previewAutoMatch({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      bankAccountId: selectedAccountId || undefined,
      matchingCriteria: criteria,
    });
  };

  const handleAutoMatch = async (statementIds: string[], criteria?: Partial<MatchingCriteria>) => {
    try {
      await confirmAutoMatch({
        statementIds,
        matchingCriteria: criteria,
      });
      refreshData();
    } catch (err) {
      console.error("Auto-match error:", err);
      throw err;
    }
  };

  const handleManualMatchConfirm = async (
    aggregateId: string,
    overrideDifference: boolean,
  ) => {
    if (!selectedStatement) return;
    try {
      await manualReconcile({
        aggregateId,
        statementId: selectedStatement.id,
        overrideDifference,
      });
      setSelectedStatement(null);
      refreshData();
    } catch (err) {
      console.error("Manual match error:", err);
    }
  };

  const handleManualMatchClick = (item: BankStatementWithMatch) => {
    setSelectedStatement(item);
  };

  const handleQuickMatch = async (
    item: BankStatementWithMatch,
    aggregateId: string,
  ) => {
    const potentialMatch = potentialMatchesMap[item.id]?.[0];
    const paymentMethodName = potentialMatch?.payment_method_name || 'Payment Gateway';
    const branchName = potentialMatch?.branch_name || '';
    const amount = potentialMatch?.nett_amount || 0;
    
    const message = branchName 
      ? `Cocokkan transaksi ini dengan ${paymentMethodName} (${branchName}) senilai ${amount.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}?`
      : `Cocokkan transaksi ini dengan ${paymentMethodName} senilai ${amount.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}?`;
    
    if (confirm(message)) {
      try {
        await manualReconcile({
          aggregateId,
          statementId: item.id,
          overrideDifference: false,
        });
        refreshData();
      } catch (err) {
        const axiosErr = err as { response?: { data?: { code?: string; message?: string }; status?: number }; message?: string };
        if (axiosErr.response?.data?.code === 'ALREADY_RECONCILED' || axiosErr.response?.status === 409) {
          alert('Transaksi ini sudah pernah dicocokkan sebelumnya. Data akan diperbarui.');
          refreshData();
        } else {
          console.error("Quick match error:", err);
          alert(`Gagal melakukan match: ${axiosErr.response?.data?.message || axiosErr.message || 'Terjadi kesalahan'}`);
        }
      }
    }
  };

  const handleUndo = async (statementId: string) => {
    if (confirm("Apakah Anda yakin ingin membatalkan rekonsiliasi ini?")) {
      await undoReconciliation(statementId);
      refreshData();
    }
  };

  const handleMultiMatchFromTable = (items: BankStatementWithMatch[]) => {
    setMultiMatchSelectedStatements(items);
    setSelectedAggregateForMultiMatch(null);
    setIsMultiMatchModalOpen(true);
  };

  const handleFindAggregateForMultiMatch = async (
    statementIds: string[],
  ): Promise<AggregatedTransactionListItem | null> => {
    try {
      const normalizedStatementIds = statementIds.map(id => String(id));
      const totalAmount = statements
        .filter((s) => normalizedStatementIds.includes(String(s.id)))
        .reduce((sum, s) => sum + (s.credit_amount || 0) - (s.debit_amount || 0), 0);

      const filter: AggregatedTransactionFilterParams = {
        is_reconciled: false,
      };

      const result = await posAggregatesApi.list(1, 100, null, filter);
      
      const found = result.data.find((agg) => {
        const diff = Math.abs(agg.nett_amount - totalAmount);
        const percentDiff = agg.nett_amount > 0 ? diff / agg.nett_amount : 0;
        return percentDiff <= 0.05;
      });

      if (found) {
        setSelectedAggregateForMultiMatch(found);
        return found;
      }
      return null;
    } catch (err) {
      console.error("Error finding aggregate:", err);
      return null;
    }
  };

  const handleMultiMatchConfirm = async (
    aggregateId: string,
    statementIds: string[],
    overrideDifference: boolean,
  ) => {
    try {
      const normalizedStatementIds = statementIds.map(id => String(id));
      await createMultiMatch({
        aggregateId: String(aggregateId),
        statementIds: normalizedStatementIds,
        overrideDifference,
      });
      setIsMultiMatchModalOpen(false);
      setMultiMatchSelectedStatements([]);
      setSelectedAggregateForMultiMatch(null);
      refreshData();
    } catch (err) {
      console.error("Multi-match error:", err);
    }
  };

  const handleUndoMultiMatch = async (groupId: string) => {
    if (confirm("Apakah Anda yakin ingin membatalkan multi-match ini?")) {
      try {
        await undoMultiMatch(groupId);
        refreshData();
      } catch (err) {
        console.error("Undo multi-match error:", err);
      }
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Bank Reconciliation
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
            Pantau dan cocokkan transaksi bank dengan catatan POS secara
            otomatis dan akurat.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            onClick={refreshData}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Memuat...' : 'Refresh'}
          </button>
          
          <button
            onClick={handleAutoMatchPreview}
            disabled={isLoading || isLoadingPreview}
            className="group relative flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all overflow-hidden disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-linear-to-r from-blue-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {isLoadingPreview ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Auto-Match
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 p-4 rounded-2xl flex items-center justify-between">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Bank Account Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-none pb-px">
        {bankAccounts.map((account) => (
          <button
            key={account.id}
            onClick={() => {
              setSelectedAccountId(account.id);
              if (filtersApplied) {
                fetchStatementsWithFilters({
                  ...filter,
                  bankAccountIds: [account.id],
                });
              }
            }}
            className={`px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-3 ${
              selectedAccountId === account.id
                ? "border-blue-600 text-blue-600 bg-blue-50/30 dark:bg-blue-900/10"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-800/50"
            }`}
          >
            <div className="flex flex-col items-start translate-y-0.5">
              <span className="leading-tight">{account.account_name}</span>
              <span className="text-[10px] opacity-60 font-medium">
                {account.banks.bank_name} • {account.account_number}
              </span>
            </div>
            {account.stats.unreconciled > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-5 h-5 flex items-center justify-center shadow-lg shadow-rose-500/20">
                {account.stats.unreconciled}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <BankReconciliationFilters
        filters={filter}
        onFiltersChange={setFilter}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
        bankAccounts={bankAccounts}
        isLoading={isLoading}
      />

      {/* Tab Navigation */}
      {filtersApplied && (
        <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
          <button
            className="flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 border-blue-600 text-blue-600"
          >
            <FileText className="w-4 h-4" />
            Semua Transaksi
            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-xs">
              {statements.length}
            </span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          {!filtersApplied ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-12 text-center">
              <Filter className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                Pilih Filter untuk Melihat Data
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Silakan pilih rentang tanggal dan filter lainnya, kemudian klik 
                "Terapkan Filter" untuk menampilkan data mutasi bank.
              </p>
            </div>
          ) : (
            <ErrorBoundary>
              <BankMutationTable
                items={statements}
                potentialMatchesMap={potentialMatchesMap}
                isLoadingMatches={isLoadingMatches}
                onManualMatch={handleManualMatchClick}
                onQuickMatch={handleQuickMatch}
                onCheckMatches={fetchPotentialMatches}
                onUndo={handleUndo}
                onMultiMatch={handleMultiMatchFromTable}
                reconciliationGroups={reconciliationGroups}
                showMultiMatch={true}
              />
            </ErrorBoundary>
          )}
        </div>

        {/* Sidebar */}
        {showGroupList && filtersApplied && (
          <div className="w-full lg:w-96 shrink-0">
            <div className="sticky top-6 space-y-4">
              {/* Error Display for Groups */}
              {reconciliationGroupsError && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 p-4 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                      Gagal memuat Multi-Match Groups
                    </p>
                    <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                      {reconciliationGroupsError}
                    </p>
                    <button
                      onClick={refreshData}
                      className="text-xs text-red-600 dark:text-red-400 font-semibold mt-2 hover:underline"
                    >
                      Coba lagi
                    </button>
                  </div>
                </div>
              )}
              <MultiMatchGroupList
                groups={reconciliationGroups}
                onUndoGroup={handleUndoMultiMatch}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}
      </div>

      {/* Toggle Sidebar Button */}
      {showGroupList && filtersApplied && (
        <button
          onClick={() => setShowGroupList(false)}
          className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all z-40"
          title="Sembunyikan Multi-Match Groups"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Modals */}
      <AutoMatchDialog
        isOpen={isAutoMatchOpen}
        onClose={() => setIsAutoMatchOpen(false)}
        onConfirm={handleAutoMatch}
        onPreview={handleAutoMatchPreviewApi}
        isLoading={isLoading}
        dateRange={dateRange}
      />

      <ManualMatchModal
        item={selectedStatement}
        isOpen={!!selectedStatement}
        onClose={() => setSelectedStatement(null)}
        onConfirm={handleManualMatchConfirm}
        isLoading={isLoading}
      />

      <MultiMatchModal
        aggregate={selectedAggregateForMultiMatch}
        statements={unreconciledStatements}
        isOpen={isMultiMatchModalOpen}
        onClose={() => {
          setIsMultiMatchModalOpen(false);
          setMultiMatchSelectedStatements([]);
          setSelectedAggregateForMultiMatch(null);
        }}
        onConfirm={handleMultiMatchConfirm}
        isLoading={isLoading}
        initialStatements={multiMatchSelectedStatements}
        onFindAggregate={handleFindAggregateForMultiMatch}
      />

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-2xl">
          <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h4 className="text-blue-900 dark:text-blue-100 font-bold mb-1 text-lg">
            Pro-Tip: Multi-Matching
          </h4>
          <p className="text-blue-700/80 dark:text-blue-200/60 text-sm leading-relaxed max-w-2xl">
            Ketika satu transaksi POS dipecah menjadi beberapa statement bank,
            gunakan fitur Multi-Match untuk mencocokkan 1 POS dengan multiple
            statements sekaligus.
          </p>
        </div>
        <button
          onClick={() => setShowGroupList(!showGroupList)}
          className="md:ml-auto flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold text-sm rounded-xl border border-blue-100 dark:border-blue-800 hover:shadow-lg transition-all"
        >
          {showGroupList ? (
            <>
              <X className="w-4 h-4" />
              Sembunyikan Groups
            </>
          ) : (
            <>
              <LayoutGrid className="w-4 h-4" />
              Tampilkan Groups
            </>
          )}
        </button>
      </div>
    </div>
  );
}

