/**
 * BankReconciliationPage — updated to use ReconciliationWizard
 *
 * Changes from original:
 * - Removed: ManualMatchModal, AutoMatchDialog, MultiMatchModal imports
 * - Added: ReconciliationWizard (single entry/exit point)
 * - Added: "Rekonsiliasi" button in BankMutationTable toolbar
 * - Simplified modal state (3 states → 1)
 */

import type {
  AggregatedTransactionListItem,
  AggregatedTransactionFilterParams,
} from "@/features/pos-aggregates/types";
import { posAggregatesApi } from "@/features/pos-aggregates/api/posAggregates.api";
import { useState, useCallback, useEffect, useMemo } from "react";
import {
  RefreshCw,
  ShieldCheck,
  X,
  FileText,
  Calendar,
  SlidersHorizontal,
} from "lucide-react";
import { BankMutationTable } from "../components/reconciliation/BankMutationTable";
import {
  BankReconciliationFilters,
  type BankStatementFilter,
} from "../components/BankReconciliationFilters";
import { useBankReconciliation } from "../hooks/useBankReconciliation";
import type {
  BankStatementWithMatch,
  MatchingCriteria,
  ReconciliationSummary,
} from "../types/bank-reconciliation.types";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ReconciliationSummaryCards } from "../components/reconciliation/ReconciliationSummary";

// ← NEW: unified wizard
import { ReconciliationWizard } from "../components/reconciliation/ReconciliationWizard";

type DateRange = {
  startDate: string;
  endDate: string;
};

export function BankReconciliationPage() {
  // ─── Wizard state (replaces 3 separate modal states) ───
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardInitialStatements, setWizardInitialStatements] = useState<BankStatementWithMatch[]>([]);

  // ─── Filter/page state ───
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: "",
    endDate: "",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId] = useState<number | null>(null);

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
    fetchReconciliationGroups,
    createMultiMatch,
    undoMultiMatch,
    pagination,
    setPage,
    setPageSize,
    fetchSettlementGroups,
  } = useBankReconciliation();

  useEffect(() => {
    fetchAllBankAccounts();
  }, [fetchAllBankAccounts]);

  const handleApplyFilters = useCallback(
    (filters: BankStatementFilter) => {
      if (!filters.startDate || !filters.endDate) {
        setError("Silakan pilih rentang tanggal terlebih dahulu");
        return;
      }
      setFilter(filters);
      setFiltersApplied(true);
      setError(null);
      setDateRange({
        startDate: filters.startDate || "",
        endDate: filters.endDate || "",
      });
      fetchStatementsWithFilters(filters);
      fetchReconciliationGroups(filters.startDate, filters.endDate);
      fetchSettlementGroups({
        startDate: filters.startDate,
        endDate: filters.endDate,
        limit: 50,
        offset: 0,
      });
    },
    [setFilter, fetchStatementsWithFilters, fetchReconciliationGroups, fetchSettlementGroups]
  );

  const handleClearFilters = useCallback(() => {
    clearFilter();
    setFiltersApplied(false);
    setDateRange({ startDate: "", endDate: "" });
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
        await fetchSettlementGroups({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          limit: 50,
          offset: 0,
        });
      }
    } catch (err) {
      console.error("Failed to refresh data:", err);
      setError("Gagal memuat data terbaru. Silakan coba lagi.");
    } finally {
      setIsRefreshing(false);
    }
  }, [
    filter,
    dateRange.startDate,
    dateRange.endDate,
    selectedAccountId,
    fetchStatementsWithFilters,
    fetchReconciliationGroups,
    fetchSettlementGroups,
  ]);

  const unreconciledStatements = useMemo(
    () => statements.filter((s) => !s.is_reconciled),
    [statements]
  );

  // Calculate summary data
  const summary: ReconciliationSummary | null = useMemo(() => {
    if (!statements.length && !filtersApplied) return null;
    const totalStatements = pagination.total || statements.length;
    const reconciledCount = statements.filter(s => s.is_reconciled).length;
    
    return {
      period: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      totalAggregates: 0, // Would need API support for real value
      totalStatements,
      autoMatched: 0, // Would need API support for real value
      manuallyMatched: 0, // Would need API support for real value
      discrepancies: statements.filter(s => s.status === 'DISCREPANCY').length,
      unreconciled: totalStatements - reconciledCount,
      totalDifference: reconciliationGroups.reduce((sum, g) => sum + (g.difference || 0), 0),
      percentageReconciled: totalStatements > 0 ? (reconciledCount / totalStatements) * 100 : 0,
    };
  }, [statements, reconciliationGroups, pagination.total, filtersApplied, dateRange.startDate, dateRange.endDate]);

  // ─── Wizard handlers ───────────────────────────────────

  /** Open wizard — optionally with pre-selected statements (multi-match flow) */
  const handleOpenWizard = useCallback((initial: BankStatementWithMatch[] = []) => {
    if (!filtersApplied) {
      setError("Silakan pilih rentang tanggal terlebih dahulu");
      return;
    }
    setWizardInitialStatements(initial);
    setIsWizardOpen(true);
  }, [filtersApplied]);

  const handleAutoMatchPreviewApi = useCallback(
    async (criteria?: Partial<MatchingCriteria>) => {
      if (!dateRange.startDate || !dateRange.endDate) {
        throw new Error("Silakan pilih rentang tanggal terlebih dahulu");
      }
      const activeBankAccountId = filter?.bankAccountIds?.[0] ?? undefined;
      return previewAutoMatch({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        bankAccountId: activeBankAccountId,
        matchingCriteria: criteria,
      });
    },
    [dateRange, filter, previewAutoMatch]
  );

  const handleAutoMatchConfirm = useCallback(
    async (statementIds: string[], criteria?: Partial<MatchingCriteria>) => {
      await confirmAutoMatch({ statementIds, matchingCriteria: criteria });
      refreshData();
    },
    [confirmAutoMatch, refreshData]
  );

  const handleManualMatchConfirm = useCallback(
    async (aggregateId: string, statementId: string, overrideDifference: boolean) => {
      await manualReconcile({ aggregateId, statementId, overrideDifference });
      refreshData();
    },
    [manualReconcile, refreshData]
  );

  const handleMultiMatchConfirm = useCallback(
    async (aggregateId: string, statementIds: string[], overrideDifference: boolean) => {
      await createMultiMatch({
        aggregateId: String(aggregateId),
        statementIds: statementIds.map(String),
        overrideDifference,
      });
      refreshData();
    },
    [createMultiMatch, refreshData]
  );

  const handleUndoMultiMatch = useCallback(
    async (groupId: string) => {
      await undoMultiMatch(groupId);
      refreshData();
    },
    [undoMultiMatch, refreshData]
  );

  const handleFindAggregateForMultiMatch = useCallback(
    async (statementIds: string[]): Promise<AggregatedTransactionListItem | null> => {
      try {
        const normalizedIds = statementIds.map(String);
        const totalAmount = statements
          .filter((s) => normalizedIds.includes(String(s.id)))
          .reduce((sum, s) => sum + (s.credit_amount || 0) - (s.debit_amount || 0), 0);

        const result = await posAggregatesApi.list(1, 100, null, {
          is_reconciled: false,
        } as AggregatedTransactionFilterParams);

        return (
          result.data.find((agg) => {
            const diff = Math.abs(agg.nett_amount - totalAmount);
            return agg.nett_amount > 0 ? diff / agg.nett_amount <= 0.05 : false;
          }) || null
        );
      } catch {
        return null;
      }
    },
    [statements]
  );

  const handleLoadAggregates = useCallback(async (): Promise<AggregatedTransactionListItem[]> => {
    try {
      const result = await posAggregatesApi.list(1, 100, null, {
        is_reconciled: false,
      } as AggregatedTransactionFilterParams);
      return result.data;
    } catch {
      return [];
    }
  }, []);

  // Undo remains outside wizard (row-level action)
  const handleUndo = async (statementId: string) => {
    if (confirm("Apakah Anda yakin ingin membatalkan rekonsiliasi ini?")) {
      await undoReconciliation(statementId);
      refreshData();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 p-6 lg:p-10 space-y-10 animate-in fade-in duration-700">
      
      {/* Premium Header Container */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-3">
           <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20">
                 <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                Bank Reconciliation
              </h1>
           </div>
           <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-[11px] ml-20 leading-none">
             Engineered for Precise Financial Accuracy
           </p>
        </div>

        <div className="flex items-center gap-4">
           <button
             onClick={refreshData}
             disabled={isRefreshing || isLoading}
             className="group flex items-center gap-2.5 px-6 py-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-2xl text-sm font-black uppercase tracking-widest hover:shadow-lg transition-all active:scale-95 border border-gray-100 dark:border-gray-800"
           >
             <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600" : "group-hover:text-blue-600"}`} />
             Sync Data
           </button>

           <button
             onClick={() => handleOpenWizard()}
             disabled={isLoading || !filtersApplied}
             className="group relative flex items-center gap-2.5 px-8 py-3 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-blue-500/40 hover:bg-blue-700 transition-all active:scale-95 disabled:grayscale disabled:opacity-50 overflow-hidden"
           >
             <div className="absolute inset-0 bg-linear-to-r from-blue-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
             <SlidersHorizontal className="w-4 h-4 group-hover:scale-125 transition-transform" />
             Execute Reconciliation
           </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl flex items-center justify-between animate-in slide-in-from-top duration-300 shadow-sm" role="alert">
          <div className="flex items-center gap-3">
            <X className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-400 font-black uppercase tracking-tight">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors">
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,360px] gap-10">
        
        {/* Left Column: Stats & Primary Actions */}
        <div className="space-y-10">
          
          {/* Summary Widgets */}
          <ReconciliationSummaryCards summary={summary} />

          {/* Filters Pad */}
          <div className="bg-white dark:bg-gray-900 p-2 rounded-4xl border border-gray-100 dark:border-gray-800 shadow-xs">
            <BankReconciliationFilters
              filters={filter}
              onFiltersChange={setFilter}
              onApplyFilters={handleApplyFilters}
              onClearFilters={handleClearFilters}
              bankAccounts={bankAccounts}
              isLoading={isLoading}
            />
          </div>

          {/* Table Control & Navigation */}
          {filtersApplied && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-6 px-2">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl shadow-inner">
                  <button className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-white dark:bg-gray-900 text-blue-600 shadow-md">
                    <FileText className="w-3.5 h-3.5" />
                    Activity Log
                    <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-md text-[9px]">
                      {pagination.total}
                    </span>
                  </button>
                </div>
              </div>

              <ErrorBoundary>
                <BankMutationTable
                  items={statements}
                  potentialMatchesMap={potentialMatchesMap}
                  isLoadingMatches={isLoadingMatches}
                  onManualMatch={(item) => handleOpenWizard([item])}
                  onQuickMatch={async (item, aggregateId) => {
                    const msg = `Cocokkan transaksi ini?`;
                    if (confirm(msg)) {
                      try {
                        await manualReconcile({ aggregateId, statementId: item.id, overrideDifference: false });
                        refreshData();
                      } catch (err) {
                        const axiosErr = err as { response?: { data?: { code?: string; message?: string }; status?: number }; message?: string };
                        if (axiosErr.response?.data?.code === "ALREADY_RECONCILED" || axiosErr.response?.status === 409) {
                          refreshData();
                        } else {
                          setError(`Gagal: ${axiosErr.response?.data?.message || axiosErr.message || "Terjadi kesalahan"}`);
                        }
                      }
                    }
                  }}
                  onCheckMatches={fetchPotentialMatches}
                  onUndo={handleUndo}
                  onMultiMatch={(items) => handleOpenWizard(items)}
                  reconciliationGroups={reconciliationGroups}
                  showMultiMatch={true}
                  isTableLoading={isLoading}
                  pagination={pagination}
                  onPageChange={setPage}
                  onLimitChange={setPageSize}
                  onOpenWizard={() => handleOpenWizard()}
                  onUndoGroup={handleUndoMultiMatch}
                />
              </ErrorBoundary>
            </div>
          )}

          {/* Empty State Overlay */}
          {!filtersApplied && (
            <div className="relative py-20 px-10 bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 text-center overflow-hidden group">
               <div className="absolute inset-0 bg-linear-to-br from-blue-50/0 to-blue-50/50 dark:to-blue-900/5 pointer-events-none" />
               <div className="relative z-10 space-y-8">
                  <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mx-auto transition-transform group-hover:rotate-12 duration-500 shadow-xl shadow-blue-500/10">
                     <Calendar className="w-10 h-10 text-blue-600" strokeWidth={2.5} />
                  </div>
                  <div className="space-y-2">
                     <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Ready to Audit?</h3>
                     <p className="text-gray-500 font-bold uppercase tracking-widest text-[11px]">Select parameters above to initialize synchronization</p>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Right Column: Mini Info / Guide / Legend */}
        <div className="space-y-10">
           <div className="bg-linear-to-br from-gray-900 to-indigo-950 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10 space-y-6">
                 <h4 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                    Pro Tip
                 </h4>
                 <p className="text-blue-100 text-sm font-semibold leading-relaxed">
                   Use the <strong className="text-white">Rekonsiliasi</strong> wizard to resolve transactions based on reference numbers and fuzzy amount matching.
                 </p>
              </div>
           </div>
        </div>
      </div>

      {/* ─── Unified Wizard (replaces 3 modals) ─── */}
      <ReconciliationWizard
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setWizardInitialStatements([]);
        }}
        statements={unreconciledStatements}
        dateRange={dateRange}
        isLoading={isLoading}
        initialStatements={wizardInitialStatements}
        onAutoMatchPreview={handleAutoMatchPreviewApi}
        onAutoMatchConfirm={handleAutoMatchConfirm}
        onManualMatchConfirm={handleManualMatchConfirm}
        onMultiMatchConfirm={handleMultiMatchConfirm}
        onFindAggregate={handleFindAggregateForMultiMatch}
        onLoadAggregates={handleLoadAggregates}
      />
    </div>
  );
}
