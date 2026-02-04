import type {
  AggregatedTransactionListItem,
  AggregatedTransactionFilterParams,
} from "@/features/pos-aggregates/types";
import { posAggregatesApi } from "@/features/pos-aggregates/api/posAggregates.api";
import { useState, useCallback, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  LayoutGrid,
  X,
  Filter,
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
  AutoMatchRequest,
} from "../types/bank-reconciliation.types";

export function BankReconciliationPage() {
  // companyId is now handled by the branch context middleware on backend
  // No need to pass companyId explicitly

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isAutoMatchOpen, setIsAutoMatchOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<BankStatementWithMatch | null>(null);
  
  // Multi-match state
  const [isMultiMatchModalOpen, setIsMultiMatchModalOpen] = useState(false);
  const [multiMatchSelectedStatements, setMultiMatchSelectedStatements] = useState<BankStatementWithMatch[]>([]);
  const [selectedAggregateForMultiMatch, setSelectedAggregateForMultiMatch] = useState<AggregatedTransactionListItem | null>(null);
  const [showGroupList, setShowGroupList] = useState(true);

  // Track if user has applied filters (useState instead of useRef)
  const [filtersApplied, setFiltersApplied] = useState(false);

  // Default date range (empty - user must apply filters)
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  const {
    statements,
    bankAccounts,
    isLoading,
    fetchStatementsWithFilters,
    fetchAllBankAccounts,
    autoMatch,
    manualReconcile,
    undoReconciliation,
    fetchPotentialMatches,
    potentialMatchesMap,
    isLoadingMatches,
    // Filter state
    filter,
    setFilter,
    clearFilter,
    // Multi-match
    reconciliationGroups,
    multiMatchSuggestions,
    isLoadingSuggestions,
    fetchSuggestedGroupStatements,
    fetchReconciliationGroups,
    createMultiMatch,
    undoMultiMatch,
  } = useBankReconciliation();

  // Fetch all bank accounts on mount (for filter dropdown)
  useEffect(() => {
    fetchAllBankAccounts();
  }, [fetchAllBankAccounts]);

  // Handle apply filters
  const handleApplyFilters = useCallback((filters: BankStatementFilter) => {
    // Update filter state
    setFilter(filters);
    setFiltersApplied(true);

    // Update date range for other functions
    if (filters.startDate || filters.endDate) {
      setDateRange({
        startDate: filters.startDate || '',
        endDate: filters.endDate || '',
      });
    }

    // Fetch statements with filters
    fetchStatementsWithFilters(filters);
    
    // Also fetch groups if dates are provided
    if (filters.startDate && filters.endDate) {
      fetchReconciliationGroups(filters.startDate, filters.endDate);
    }
  }, [setFilter, fetchStatementsWithFilters, fetchReconciliationGroups]);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    clearFilter();
    setFiltersApplied(false);
    setDateRange({ startDate: '', endDate: '' });
  }, [clearFilter]);

  // Refresh data function
  const refreshData = useCallback(() => {
    // Use current filter state for refresh
    const currentFilter = {
      ...filter,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      bankAccountIds: selectedAccountId ? [selectedAccountId] : undefined,
    };
    
    fetchStatementsWithFilters(currentFilter);
    
    if (dateRange.startDate && dateRange.endDate) {
      fetchReconciliationGroups(dateRange.startDate, dateRange.endDate);
    }
  }, [filter, dateRange.startDate, dateRange.endDate, selectedAccountId, fetchStatementsWithFilters, fetchReconciliationGroups]);

  // Set initial selected account if not set
  useEffect(() => {
    if (!selectedAccountId && bankAccounts.length > 0) {
      const timeoutId = setTimeout(() => {
        setSelectedAccountId(bankAccounts[0].id);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [bankAccounts, selectedAccountId]);

  const handleAutoMatch = async (payload: Omit<AutoMatchRequest, "companyId">) => {
    try {
      await autoMatch({
        ...payload,
        bankAccountId: selectedAccountId || undefined,
      });
      setIsAutoMatchOpen(false);
      refreshData();
    } catch (err) {
      console.error("Auto-match error:", err);
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
    if (
      confirm(
        `Cocokkan transaksi ini dengan ${item.potentialMatches?.[0]?.payment_method_name} senilai ${item.potentialMatches?.[0]?.nett_amount.toLocaleString("id-ID")}?`,
      )
    ) {
      try {
        await manualReconcile({
          aggregateId,
          statementId: item.id,
          overrideDifference: false,
        });
        refreshData();
      } catch (err) {
        console.error("Quick match error:", err);
      }
    }
  };

  const handleUndo = async (statementId: string) => {
    if (confirm("Apakah Anda yakin ingin membatalkan rekonsiliasi ini?")) {
      await undoReconciliation(statementId);
      refreshData();
    }
  };

  // Multi-match handlers
  const handleMultiMatchFromTable = (items: BankStatementWithMatch[]) => {
    setMultiMatchSelectedStatements(items);
    setSelectedAggregateForMultiMatch(null);
    setIsMultiMatchModalOpen(true);
  };

  const handleLoadSuggestions = async (aggregateId: string) => {
    await fetchSuggestedGroupStatements(aggregateId);
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

  // Filter statements for modal (only unreconciled)
  const unreconciledStatements = statements.filter((s) => !s.is_reconciled);

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header section */}
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
            onClick={() => setIsAutoMatchOpen(true)}
            disabled={isLoading}
            className="group relative flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all overflow-hidden disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-linear-to-r from-blue-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Auto-Match
          </button>
        </div>
      </div>

      {/* Bank Account Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-none pb-px">
        {bankAccounts.map((account) => (
          <button
            key={account.id}
            onClick={() => {
              setSelectedAccountId(account.id);
              // Refetch when switching accounts
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

      {/* Filters Section */}
      <BankReconciliationFilters
        bankAccounts={bankAccounts}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
        isLoading={isLoading}
      />

      {/* Main Content Area - with sidebar for groups */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column - Main content */}
        <div className="flex-1">
          {!filtersApplied ? (
            // Empty state - show message
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
          )}
        </div>

        {/* Right column - Sidebar with Multi-Match Groups */}
        {showGroupList && filtersApplied && (
          <div className="w-full lg:w-96 shrink-0">
            <div className="sticky top-6">
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
        suggestions={multiMatchSuggestions}
        isOpen={isMultiMatchModalOpen}
        onClose={() => {
          setIsMultiMatchModalOpen(false);
          setMultiMatchSelectedStatements([]);
          setSelectedAggregateForMultiMatch(null);
        }}
        onConfirm={handleMultiMatchConfirm}
        isLoading={isLoadingSuggestions || isLoading}
        onLoadSuggestions={handleLoadSuggestions}
        initialStatements={multiMatchSelectedStatements}
        onFindAggregate={handleFindAggregateForMultiMatch}
      />

      {/* Tips/Helper Section */}
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

