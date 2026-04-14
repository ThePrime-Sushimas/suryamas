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
  Calendar,
  Play,
} from "lucide-react";
import { BankMutationTable } from "../components/reconciliation/BankMutationTable";
import {
  BankReconciliationFilters,
  type BankStatementFilter,
} from "../components/BankReconciliationFilters";
import { useBankReconciliation } from "../hooks/useBankReconciliation";

import { ErrorBoundary } from "../components/ErrorBoundary";
import { SettlementGroupList } from "../components/reconciliation/SettlementGroupList";
import type {
  BankStatementWithMatch,
  MatchingCriteria,
} from "../types/bank-reconciliation.types";

// ← NEW: unified wizard
import { ReconciliationWizard } from "../components/reconciliation/ReconciliationWizard";
import { settlementGroupsApi } from "../settlement-groups/api/settlement-groups.api";
import type { CreateSettlementGroupResultDto } from "../settlement-groups/types/settlement-groups.types";

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
    settlementGroups,
    settlementGroupsTotal,
    deleteSettlementGroup,
  } = useBankReconciliation();

  const unreconciledStatements = useMemo(
    () => statements.filter((s) => !s.is_reconciled),
    [statements]
  );

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

  const handleDeleteSettlementGroup = useCallback(
    async (groupId: string) => {
      await deleteSettlementGroup(groupId);
      refreshData();
    },
    [deleteSettlementGroup, refreshData]
  );

  const handleSettlementConfirm = useCallback(
    async (
      bankStatementId: string,
      aggregateIds: string[],
      notes: string,
      overrideDifference: boolean
    ): Promise<CreateSettlementGroupResultDto> => {
      const result = await settlementGroupsApi.createSettlementGroup({
        bankStatementId,
        aggregateIds,
        notes,
        overrideDifference,
      });
      refreshData();
      return result;
    },
    [refreshData]
  );

  // Undo remains outside wizard (row-level action)
  const handleUndo = async (statementId: string) => {
    if (confirm("Apakah Anda yakin ingin membatalkan rekonsiliasi ini?")) {
      await undoReconciliation(statementId);
      refreshData();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 p-4 lg:p-6 space-y-4 animate-in fade-in duration-500">
      
      {/* Header — compact */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bank Reconciliation</h1>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Cocokkan mutasi bank dengan transaksi POS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshData}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => handleOpenWizard()}
            disabled={isLoading || !filtersApplied}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-all disabled:opacity-40"
          >
            <Play className="w-3.5 h-3.5" />
            Rekonsiliasi
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between" role="alert">
          <p className="text-xs text-red-700 dark:text-red-400 font-medium">{error}</p>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded">
            <X className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,340px] gap-4">
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-200 dark:border-gray-800">
            <BankReconciliationFilters
              filters={filter}
              onFiltersChange={setFilter}
              onApplyFilters={handleApplyFilters}
              onClearFilters={handleClearFilters}
              bankAccounts={bankAccounts}
              isLoading={isLoading}
            />
          </div>

          {/* Table */}
          {filtersApplied && (
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
                  reconciliationGroups={reconciliationGroups}
                  isTableLoading={isLoading}
                  pagination={pagination}
                  onPageChange={setPage}
                  onLimitChange={setPageSize}
                  onUndoGroup={handleUndoMultiMatch}
                  bankAccounts={bankAccounts}
                  activeBankAccountIds={filter.bankAccountIds}
                />
            </ErrorBoundary>
          )}

          {/* Empty State */}
          {!filtersApplied && (
            <div className="py-16 px-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
              <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pilih rentang tanggal untuk memulai rekonsiliasi</p>
            </div>
          )}
        </div>

        {/* Right Column: Settlement Groups */}
        <div className="space-y-4">
           {filtersApplied && settlementGroups.length > 0 && (
             <ErrorBoundary>
               <SettlementGroupList
                 groups={settlementGroups}
                 total={settlementGroupsTotal}
                 onDelete={handleDeleteSettlementGroup}
               />
             </ErrorBoundary>
           )}
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
        onSettlementConfirm={handleSettlementConfirm}
      />
    </div>
  );
}
