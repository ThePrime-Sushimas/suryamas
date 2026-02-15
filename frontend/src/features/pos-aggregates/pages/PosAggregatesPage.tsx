/**
 * PosAggregatesPage.tsx
 * 
 * Main page for listing aggregated transactions.
 * Features: list view, filters, pagination, bulk actions, summary.
 */

import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, CheckCircle, Database } from 'lucide-react'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContextStore } from '@/features/branch_context'
import { PosAggregatesTable } from '../components/PosAggregatesTable'
import { PosAggregatesFilters } from '../components/PosAggregatesFilters'
import { PosAggregatesForm } from '../components/PosAggregatesForm'
import { PosAggregatesSummary } from '../components/PosAggregatesSummary'
import { GenerateFromImportModal } from '../components/GenerateFromImportModal'
import { GenerateJournalModal } from '../components/GenerateJournalModal'
import { BankMutationSelectorModal } from '../components/BankMutationSelectorModal'
import { bankReconciliationApi } from '@/features/bank-reconciliation/api/bank-reconciliation.api'
import type { 
  CreateAggregatedTransactionDto, 
  UpdateAggregatedTransactionDto 
} from '../types'
import type { AggregatedTransactionListItem } from '../types'

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
  const navigate = useNavigate()
  const toast = useToast()
  const currentBranch = useBranchContextStore((s) => s.currentBranch)
  
  // Store
  const {
    transactions,
    selectedIds,
    page,
    limit,
    total,
    totalPages,
    summary,
    isLoading,
    isMutating,
    isSummaryLoading,
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
  } = usePosAggregatesStore()

  // Local state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showGenerateJournalModal, setShowGenerateJournalModal] = useState(false)
  const [showGenerateFromImportModal, setShowGenerateFromImportModal] = useState(false)

  // Note: No auto-fetch on mount - user must click "Apply Filters" first

  // Handle edit
  const handleEdit = useCallback((id: string) => {
    setEditingId(id)
    setShowForm(true)
  }, [])

  // Handle delete
  const handleDelete = useCallback(async (id: string, sourceRef: string) => {
    try {
      await deleteTransaction(id)
      toast.success(`Transaksi "${sourceRef}" berhasil dihapus`)
      await fetchSummary() // Refresh summary - await to ensure consistency
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus transaksi')
    }
  }, [deleteTransaction, toast, fetchSummary])

  // Handle restore
  // Note: restoreTransaction already calls fetchTransactions internally
  const handleRestore = useCallback(async (id: string, sourceRef: string) => {
    try {
      await restoreTransaction(id)
      toast.success(`Transaksi "${sourceRef}" berhasil dipulihkan`)
      // restoreTransaction already refreshes transactions, only need to refresh summary
      await fetchSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memulihkan transaksi')
    }
  }, [restoreTransaction, toast, fetchSummary])

  // Handle reconcile single
  const handleReconcile = useCallback(async (id: string) => {
    try {
      const employeeId = currentBranch?.employee_id || 'system'
      await reconcileTransaction(id, employeeId)
      toast.success('Transaksi berhasil direkonsiliasi')
      // Wait for both fetches to complete sequentially for UI consistency
      await fetchTransactions()
      await fetchSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal merekonsiliasi transaksi')
    }
  }, [reconcileTransaction, toast, currentBranch, fetchTransactions, fetchSummary])

  // Handle batch reconcile
  // Note: batchReconcile already handles optimistic update, clearSelection, and refresh internally
  // So we don't need to call fetchTransactions/fetchSummary here - it would cause redundant API calls
  const handleBatchReconcile = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning('Pilih transaksi yang akan direkonsiliasi')
      return
    }

    try {
      const employeeId = currentBranch?.employee_id || 'system'
      // batchReconcile already:
      // 1. Updates transactions optimistically (is_reconciled: true)
      // 2. Clears selectedIds
      // 3. Refreshes data via fetchTransactions and fetchSummary internally
      const count = await batchReconcile(Array.from(selectedIds), employeeId)
      toast.success(`${count} transaksi berhasil direkonsiliasi`)
      // clearSelection is called internally by batchReconcile, no need to call again
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal merekonsiliasi transaksi secara batch')
    }
  }, [selectedIds, batchReconcile, toast, currentBranch])

// Handle view detail
  const handleViewDetail = useCallback((id: string) => {
    navigate(`/pos-aggregates/${id}`)
  }, [navigate])

  // Handle form submit
  const handleSubmit = useCallback(async (data: CreateAggregatedTransactionDto | UpdateAggregatedTransactionDto) => {
    try {
      if (editingId) {
        await updateTransaction(editingId, data as UpdateAggregatedTransactionDto)
        toast.success('Transaksi agregat berhasil diperbarui')
      } else {
        await createTransaction(data as CreateAggregatedTransactionDto)
        toast.success('Transaksi agregat berhasil dibuat')
      }
      setShowForm(false)
      setEditingId(null)
      // Wait for both fetches to complete sequentially for UI consistency
      await fetchTransactions()
      await fetchSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan transaksi')
    }
  }, [editingId, createTransaction, updateTransaction, toast, fetchTransactions, fetchSummary])

  // Handle form close
  const handleFormClose = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
  }, [])

  // Selected transaction for edit - use AggregatedTransactionListItem since that's what the store returns
  const selectedTransaction = editingId 
    ? transactions.find((tx) => tx.id === editingId) || null 
    : null

  // State for Bank Mutation Selector Modal
  const [selectedTransactionForMatch, setSelectedTransactionForMatch] = useState<AggregatedTransactionListItem | null>(null)
  const [showMutationSelector, setShowMutationSelector] = useState(false)
  const [isMatching, setIsMatching] = useState(false)

  // Handle select bank mutation
  const handleSelectBankMutation = useCallback((transaction: AggregatedTransactionListItem) => {
    setSelectedTransactionForMatch(transaction)
    setShowMutationSelector(true)
  }, [])

  // Handle confirm bank mutation match
  const handleConfirmMutationMatch = useCallback(async (statementId: string) => {
    if (!selectedTransactionForMatch) return

    setIsMatching(true)
    try {
      await bankReconciliationApi.manualReconcile({
        aggregateId: selectedTransactionForMatch.id,
        statementId,
      })
      toast.success(`Transaksi "${selectedTransactionForMatch.source_ref}" berhasil dicocokkan dengan mutasi bank`)
      
      // Wait for both fetches to complete sequentially for UI consistency
      await fetchTransactions()
      await fetchSummary()
      
      // Close modal
      setShowMutationSelector(false)
      setSelectedTransactionForMatch(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mencocokkan transaksi')
    } finally {
      setIsMatching(false)
    }
  }, [selectedTransactionForMatch, toast, fetchTransactions, fetchSummary])

  // Pagination info
  const showingStart = (page - 1) * limit + 1
  const showingEnd = Math.min(page * limit, total)

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transaksi Agregat POS</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola transaksi agregat dari import POS dan buat jurnal
          </p>
        </div>
        <div className="flex items-center gap-3">

          {/* Generate from POS Import Button */}
          <button
            onClick={() => setShowGenerateFromImportModal(true)}
            className="px-3 py-2 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            Generate dari Import
          </button>

          {/* Generate Journal Button */}
          <button
            onClick={() => setShowGenerateJournalModal(true)}
            className="px-3 py-2 text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Buat Jurnal
          </button>

          {/* Create Button */}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Tambah Transaksi
          </button>
        </div>
      </div>

      {/* Summary */}
      <PosAggregatesSummary summary={summary} isLoading={isSummaryLoading} className="mb-6" />

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              {selectedIds.size} transaksi dipilih
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBatchReconcile}
              className="px-3 py-1.5 text-sm text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-1"
            >
              <CheckCircle className="w-4 h-4" />
              Rekonsiliasi Terpilih
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Batalkan Pilihan
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Transaksi Agregat' : 'Transaksi Agregat Baru'}
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
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {!showForm && <PosAggregatesFilters />}

      {/* Table */}
      {!showForm && (
        <>
          <PosAggregatesTable
            transactions={transactions}
            selectedIds={selectedIds}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onReconcile={handleReconcile}
            onViewDetail={handleViewDetail}
            onSelectBankMutation={handleSelectBankMutation}
            onToggleSelection={(id) => usePosAggregatesStore.getState().toggleSelection(id)}
            onToggleAllSelection={() => usePosAggregatesStore.getState().toggleAllSelection()}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between mt-4 gap-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Menampilkan {showingStart} - {showingEnd} dari {total} data
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Halaman {page} dari {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
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
          await fetchTransactions()
          await fetchSummary()
        }}
      />

      {/* Bank Mutation Selector Modal */}
      <BankMutationSelectorModal
        isOpen={showMutationSelector}
        onClose={() => {
          setShowMutationSelector(false)
          setSelectedTransactionForMatch(null)
        }}
        onConfirm={handleConfirmMutationMatch}
        aggregate={selectedTransactionForMatch}
        isLoading={isMatching}
      />
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesPage

