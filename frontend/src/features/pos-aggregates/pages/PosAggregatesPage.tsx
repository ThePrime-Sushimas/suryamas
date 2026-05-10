/**
 * PosAggregatesPage.tsx
 *
 * Main page for listing aggregated transactions.
 * Features: list view, filters, pagination, bulk actions, summary.
 */

import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, CheckCircle, Database, Calculator, RefreshCw } from "lucide-react";
import { usePosAggregatesStore } from "../store/posAggregates.store";
import { useToast } from "@/contexts/ToastContext";
import { useBranchContextStore } from "@/features/branch_context";
import { PosAggregatesTable } from "../components/PosAggregatesTable";
import { PosAggregatesFilters } from "../components/PosAggregatesFilters";
import { PosAggregatesForm } from "../components/PosAggregatesForm";
import { PosAggregatesSummary } from "../components/PosAggregatesSummary";
import { GenerateFromImportModal } from "../components/GenerateFromImportModal";
import { GenerateJournalModal } from "../components/GenerateJournalModal";
import { BankMutationSelectorModal } from "../components/BankMutationSelectorModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { bankReconciliationApi } from "@/features/bank-reconciliation/api/bank-reconciliation.api";
import { posAggregatesApi } from "../api/posAggregates.api";
import { POS_AGGREGATES_MESSAGES } from "@/utils/messages";
import type {
  CreateAggregatedTransactionDto,
  UpdateAggregatedTransactionDto,
} from "../types";
import type { AggregatedTransactionListItem } from "../types";

// =============================================================================
// PROPS (None for main page)
// =============================================================================

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Main page for aggregated transactions
 * Provides list view with filtering, pagination, and bulk actions
 */
export const PosAggregatesPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const currentBranch = useBranchContextStore((s) => s.currentBranch);

  // Store
  const {
    transactions,
    selectedIds,
    page,
    limit,
    total,
    totalPages,
    summary,
    isMutating,
    isDataLoading,
    fetchTransactions,
    fetchSummary,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
    reconcileTransaction,
    batchReconcile,
    setPage,
    clearSelection,
  } = usePosAggregatesStore();

  // Local state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showGenerateJournalModal, setShowGenerateJournalModal] =
    useState(false);
  const [showGenerateFromImportModal, setShowGenerateFromImportModal] =
    useState(false);

  // Note: No auto-fetch on mount - user must click "Apply Filters" first

  // Handle edit
  const handleEdit = useCallback((id: string) => {
    setEditingId(id);
    setShowForm(true);
  }, []);

  // Handle delete
  const handleDelete = useCallback(
    async (id: string, sourceRef: string) => {
      try {
        await deleteTransaction(id);
        toast.success(POS_AGGREGATES_MESSAGES.TRANSACTION_DELETED(sourceRef));
        await fetchSummary(); // Refresh summary - await to ensure consistency
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : POS_AGGREGATES_MESSAGES.TRANSACTION_DELETE_FAILED,
        );
      }
    },
    [deleteTransaction, toast, fetchSummary],
  );

  // Handle restore
  // Note: restoreTransaction already calls fetchTransactions internally
  const handleRestore = useCallback(
    async (id: string, sourceRef: string) => {
      try {
        await restoreTransaction(id);
        toast.success(POS_AGGREGATES_MESSAGES.TRANSACTION_RESTORED(sourceRef));
        // restoreTransaction already refreshes transactions, only need to refresh summary
        await fetchSummary();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : POS_AGGREGATES_MESSAGES.TRANSACTION_RESTORE_FAILED,
        );
      }
    },
    [restoreTransaction, toast, fetchSummary],
  );

  // Handle reconcile single
  const handleReconcile = useCallback(
    async (id: string, reason?: string) => {
      try {
        const employeeId = currentBranch?.employee_id || "system";
        await reconcileTransaction(id, employeeId, reason);
        toast.success(POS_AGGREGATES_MESSAGES.TRANSACTION_RECONCILED);
        await fetchTransactions();
        await fetchSummary();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : POS_AGGREGATES_MESSAGES.TRANSACTION_RECONCILE_FAILED,
        );
      }
    },
    [
      reconcileTransaction,
      toast,
      currentBranch,
      fetchTransactions,
      fetchSummary,
    ],
  );

  // Handle batch reconcile
  // Note: batchReconcile already handles optimistic update, clearSelection, and refresh internally
  // So we don't need to call fetchTransactions/fetchSummary here - it would cause redundant API calls
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const batchInFlight = useRef(false);

  const handleBatchReconcile = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning(POS_AGGREGATES_MESSAGES.SELECT_TRANSACTIONS_TO_RECONCILE);
      return;
    }
    setShowBatchConfirm(true);
  }, [selectedIds, toast]);

  const executeBatchReconcile = useCallback(async () => {
    if (batchInFlight.current) return;
    batchInFlight.current = true;
    setShowBatchConfirm(false);
    try {
      const employeeId = currentBranch?.employee_id || "system";
      // batchReconcile already:
      // 1. Updates transactions optimistically (is_reconciled: true)
      // 2. Clears selectedIds
      // 3. Refreshes data via fetchTransactions and fetchSummary internally
      const count = await batchReconcile(Array.from(selectedIds), employeeId);
      toast.success(
        POS_AGGREGATES_MESSAGES.TRANSACTION_BATCH_RECONCILED(count),
      );
      // clearSelection is called internally by batchReconcile, no need to call again
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : POS_AGGREGATES_MESSAGES.TRANSACTION_BATCH_RECONCILE_FAILED,
      );
    } finally {
      batchInFlight.current = false;
    }
  }, [selectedIds, batchReconcile, toast, currentBranch]);

  // Handle view detail
  const handleViewDetail = useCallback(
    (id: string) => {
      navigate(`/pos-aggregates/${id}`);
    },
    [navigate],
  );

  // Handle form submit
  const handleSubmit = useCallback(
    async (
      data: CreateAggregatedTransactionDto | UpdateAggregatedTransactionDto,
    ) => {
      try {
        if (editingId) {
          await updateTransaction(
            editingId,
            data as UpdateAggregatedTransactionDto,
          );
          toast.success(POS_AGGREGATES_MESSAGES.TRANSACTION_UPDATED);
        } else {
          await createTransaction(data as CreateAggregatedTransactionDto);
          toast.success(POS_AGGREGATES_MESSAGES.TRANSACTION_CREATED);
        }
        setShowForm(false);
        setEditingId(null);
        // Wait for both fetches to complete sequentially for UI consistency
        await fetchTransactions();
        await fetchSummary();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : POS_AGGREGATES_MESSAGES.TRANSACTION_SAVE_FAILED,
        );
      }
    },
    [
      editingId,
      createTransaction,
      updateTransaction,
      toast,
      fetchTransactions,
      fetchSummary,
    ],
  );

  // Handle form close
  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
  }, []);

  // Selected transaction for edit - use AggregatedTransactionListItem since that's what the store returns
  const selectedTransaction = editingId
    ? transactions.find((tx) => tx.id === editingId) || null
    : null;

  // State for Bank Mutation Selector Modal
  const [selectedTransactionForMatch, setSelectedTransactionForMatch] =
    useState<AggregatedTransactionListItem | null>(null);
  const [showMutationSelector, setShowMutationSelector] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [recalcDate, setRecalcDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Handle select bank mutation
  const handleSelectBankMutation = useCallback(
    (transaction: AggregatedTransactionListItem) => {
      setSelectedTransactionForMatch(transaction);
      setShowMutationSelector(true);
    },
    [],
  );

  // Handle confirm bank mutation match
  const handleConfirmMutationMatch = useCallback(
    async (statementId: string) => {
      if (!selectedTransactionForMatch) return;

      setIsMatching(true);
      try {
        await bankReconciliationApi.manualReconcile({
          aggregateId: selectedTransactionForMatch.id,
          statementId,
        });
        toast.success(
          POS_AGGREGATES_MESSAGES.TRANSACTION_MATCHED(
            selectedTransactionForMatch.source_ref,
          ),
        );

        // Wait for both fetches to complete sequentially for UI consistency
        await fetchTransactions();
        await fetchSummary();

        // Close modal
        setShowMutationSelector(false);
        setSelectedTransactionForMatch(null);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : POS_AGGREGATES_MESSAGES.TRANSACTION_MATCH_FAILED,
        );
      } finally {
        setIsMatching(false);
      }
    },
    [selectedTransactionForMatch, toast, fetchTransactions, fetchSummary],
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header — compact style */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Agregat POS
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Recalc Fee */}
          <input
            type="date"
            value={recalcDate}
            onChange={(e) => setRecalcDate(e.target.value)}
            className="px-2 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
          />
          <button
            onClick={async () => {
              if (!recalcDate) return
              setIsRecalculating(true)
              try {
                const result = await posAggregatesApi.recalculateFee(recalcDate)
                toast.success(`Fee recalculated: ${result.updated} updated, ${result.skipped} skipped`)
                fetchTransactions()
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Gagal recalculate fee')
              } finally {
                setIsRecalculating(false)
              }
            }}
            disabled={isRecalculating}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 dark:border-orange-700 dark:text-orange-300 disabled:opacity-50"
          >
            <Calculator size={15} className={isRecalculating ? 'animate-spin' : ''} />
            Recalc Fee
          </button>

          {/* Generate dari Import */}
          <button
            onClick={() => setShowGenerateFromImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300"
          >
            <Database size={15} />
            Generate dari Import
          </button>

          {/* Buat Jurnal */}
          <button
            onClick={() => setShowGenerateJournalModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 dark:border-purple-700 dark:text-purple-300"
          >
            <FileText size={15} />
            Buat Jurnal
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchTransactions()}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            <RefreshCw size={15} className={isDataLoading() ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Tambah Transaksi */}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={15} />
            Tambah
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <PosAggregatesSummary
        summary={summary}
        isLoading={isDataLoading()}
      />

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
            {selectedIds.size} transaksi dipilih
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchReconcile}
              disabled={batchInFlight.current}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
            >
              <CheckCircle size={14} />
              Rekonsiliasi Terpilih
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Batalkan
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId
                  ? "Edit Transaksi Agregat"
                  : "Transaksi Agregat Baru"}
              </h2>
              <button
                onClick={handleFormClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <PosAggregatesForm
                transaction={selectedTransaction}
                onSubmit={handleSubmit}
                onCancel={handleFormClose}
                isLoading={isMutating}
                mode={editingId ? "edit" : "create"}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {!showForm && <PosAggregatesFilters />}

      {/* Table */}
      {!showForm && (
        <PosAggregatesTable
          transactions={transactions}
          selectedIds={selectedIds}
          isLoading={isDataLoading()}
          pagination={{
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          }}
          onPageChange={(newPage) => setPage(newPage)}
          onLimitChange={(newLimit) =>
            usePosAggregatesStore.getState().setLimit(newLimit)
          }
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onReconcile={handleReconcile}
          onViewDetail={handleViewDetail}
          onSelectBankMutation={handleSelectBankMutation}
          onToggleSelection={(id) =>
            usePosAggregatesStore.getState().toggleSelection(id)
          }
          onToggleAllSelection={() =>
            usePosAggregatesStore.getState().toggleAllSelection()
          }
        />
      )}

      {/* Generate Journal Modal - New Optimized Version */}
      <GenerateJournalModal
        isOpen={showGenerateJournalModal}
        onClose={() => setShowGenerateJournalModal(false)}
      />

      {/* Generate from Import Modal */}
      <GenerateFromImportModal
        isOpen={showGenerateFromImportModal}
        onClose={() => setShowGenerateFromImportModal(false)}
        onGenerated={async () => {
          // Wait for both fetches to complete sequentially for UI consistency
          await fetchTransactions();
          await fetchSummary();
        }}
      />

      {/* Bank Mutation Selector Modal */}
      <BankMutationSelectorModal
        isOpen={showMutationSelector}
        onClose={() => {
          setShowMutationSelector(false);
          setSelectedTransactionForMatch(null);
        }}
        onConfirm={handleConfirmMutationMatch}
        aggregate={selectedTransactionForMatch}
        isLoading={isMatching}
      />

      {/* Batch Reconcile Confirm Modal */}
      <ConfirmModal
        isOpen={showBatchConfirm}
        onClose={() => setShowBatchConfirm(false)}
        onConfirm={executeBatchReconcile}
        title="Rekonsiliasi Terpilih"
        message={`Anda akan merekonsiliasi ${selectedIds.size} transaksi. Lanjutkan?`}
        confirmText="Ya, Rekonsiliasi"
        cancelText="Batal"
        variant="info"
      />
    </div>
  );
};

export default PosAggregatesPage;
