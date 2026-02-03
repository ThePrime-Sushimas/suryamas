import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  LayoutGrid,
  X,
} from "lucide-react";
import { ReconciliationSummaryCards } from "../components/reconciliation/ReconciliationSummary";
import { BankMutationTable } from "../components/reconciliation/BankMutationTable";
import { ManualMatchModal } from "../components/reconciliation/ManualMatchModal";
import { AutoMatchDialog } from "../components/reconciliation/AutoMatchDialog";
import { MultiMatchModal } from "../components/reconciliation/MultiMatchModal";
import { MultiMatchGroupList } from "../components/reconciliation/MultiMatchGroupList";
import { useBankReconciliation } from "../hooks/useBankReconciliation";
import { useBranchContextStore } from "@/features/branch_context/store/branchContext.store";
import type {
  BankStatementWithMatch,
  AutoMatchRequest,
} from "../types/bank-reconciliation.types";
import type {
  AggregatedTransactionListItem,
  AggregatedTransactionFilterParams,
} from "@/features/pos-aggregates/types";
import { posAggregatesApi } from "@/features/pos-aggregates/api/posAggregates.api";

export function BankReconciliationPage() {
  const { currentBranch } = useBranchContextStore();
  const companyId = currentBranch?.company_id || "";

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isAutoMatchOpen, setIsAutoMatchOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<BankStatementWithMatch | null>(null);
  
  // Multi-match state
  const [isMultiMatchModalOpen, setIsMultiMatchModalOpen] = useState(false);
  const [multiMatchSelectedStatements, setMultiMatchSelectedStatements] = useState<BankStatementWithMatch[]>([]);
  const [selectedAggregateForMultiMatch, setSelectedAggregateForMultiMatch] = useState<AggregatedTransactionListItem | null>(null);
  const [showGroupList, setShowGroupList] = useState(true);

  // Track if initial data has been loaded
  const initialDataLoaded = useRef(false);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const {
    summary,
    statements,
    bankAccounts,
    isLoading,
    fetchSummary,
    fetchStatements,
    autoMatch,
    manualReconcile,
    undoReconciliation,
    fetchPotentialMatches,
    potentialMatchesMap,
    isLoadingMatches,
    // Multi-match
    reconciliationGroups,
    multiMatchSuggestions,
    isLoadingSuggestions,
    fetchSuggestedGroupStatements,
    fetchReconciliationGroups,
    createMultiMatch,
    undoMultiMatch,
  } = useBankReconciliation(companyId);

  // Handle month navigation
  const handlePrevMonth = useCallback(() => {
    const start = new Date(dateRange.startDate);
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    setDateRange({
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    });
    // Reset flag for new date range
    initialDataLoaded.current = false;
  }, [dateRange.startDate]);

  const handleNextMonth = useCallback(() => {
    const start = new Date(dateRange.startDate);
    start.setMonth(start.getMonth() + 1);
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    setDateRange({
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    });
    // Reset flag for new date range
    initialDataLoaded.current = false;
  }, [dateRange.startDate]);

  // Initial data load - only once per company/date range
  useEffect(() => {
    if (companyId && !initialDataLoaded.current) {
      initialDataLoaded.current = true;
      
      // Use setTimeout to break synchronous updates
      const timer = setTimeout(() => {
        fetchSummary(dateRange.startDate, dateRange.endDate);
        fetchStatements(dateRange.startDate, dateRange.endDate);
        fetchReconciliationGroups(dateRange.startDate, dateRange.endDate);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [companyId, dateRange.startDate, dateRange.endDate, fetchSummary, fetchStatements, fetchReconciliationGroups]);

  // Refresh data function
  const refreshData = useCallback(() => {
    if (!companyId) return;
    fetchSummary(dateRange.startDate, dateRange.endDate);
    fetchStatements(dateRange.startDate, dateRange.endDate, selectedAccountId || undefined);
    fetchReconciliationGroups(dateRange.startDate, dateRange.endDate);
  }, [companyId, dateRange.startDate, dateRange.endDate, selectedAccountId, fetchSummary, fetchStatements, fetchReconciliationGroups]);

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
          <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <div className="px-4 py-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <CalendarIcon className="w-4 h-4 text-blue-500" />
              <span>
                {new Date(dateRange.startDate).toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>

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

      {/* Summary Cards */}
      {summary && <ReconciliationSummaryCards summary={summary} />}

      {/* Bank Account Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-none pb-px">
        {bankAccounts.map((account) => (
          <button
            key={account.id}
            onClick={() => setSelectedAccountId(account.id)}
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

      {/* Main Content Area - with sidebar for groups */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column - Main content */}
        <div className="flex-1">
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
        </div>

        {/* Right column - Sidebar with Multi-Match Groups */}
        {showGroupList && (
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
      {!showGroupList && (
        <button
          onClick={() => setShowGroupList(true)}
          className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all z-40"
          title="Tampilkan Multi-Match Groups"
        >
          <LayoutGrid className="w-6 h-6" />
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

