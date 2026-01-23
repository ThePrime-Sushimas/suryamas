/**
 * PosAggregatesPage.tsx
 * 
 * Main page for listing aggregated transactions.
 * Features: list view, filters, pagination, bulk actions, summary.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { Plus, FileText, RefreshCw, CheckCircle, FilePlus } from 'lucide-react'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContextStore } from '@/features/branch_context'
import { PosAggregatesTable } from '../components/PosAggregatesTable'
import { PosAggregatesFilters } from '../components/PosAggregatesFilters'
import { PosAggregatesForm } from '../components/PosAggregatesForm'
import { PosAggregatesSummary } from '../components/PosAggregatesSummary'
import type { CreateAggregatedTransactionDto, UpdateAggregatedTransactionDto } from '../types'

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
    generateJournal,
    setPage,
    clearSelection,
  } = usePosAggregatesStore()

  // Local state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showGenerateJournalModal, setShowGenerateJournalModal] = useState(false)
  const [journalDateFrom, setJournalDateFrom] = useState('')
  const [journalDateTo, setJournalDateTo] = useState('')
  const [includeUnreconciledOnly, setIncludeUnreconciledOnly] = useState(false)
  const [generatingJournal, setGeneratingJournal] = useState(false)

  // Fetch data on mount
  useEffect(() => {
    fetchTransactions()
    fetchSummary()
  }, [fetchTransactions, fetchSummary])

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
      fetchSummary() // Refresh summary
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus transaksi')
    }
  }, [deleteTransaction, toast, fetchSummary])

  // Handle restore
  const handleRestore = useCallback(async (id: string, sourceRef: string) => {
    try {
      await restoreTransaction(id)
      toast.success(`Transaksi "${sourceRef}" berhasil dipulihkan`)
      fetchTransactions()
      fetchSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memulihkan transaksi')
    }
  }, [restoreTransaction, toast, fetchTransactions, fetchSummary])

  // Handle reconcile single
  const handleReconcile = useCallback(async (id: string) => {
    try {
      const employeeId = currentBranch?.employee_id || 'system'
      await reconcileTransaction(id, employeeId)
      toast.success('Transaksi berhasil direkonsiliasi')
      fetchTransactions()
      fetchSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal merekonsiliasi transaksi')
    }
  }, [reconcileTransaction, toast, currentBranch?.employee_id, fetchTransactions, fetchSummary])

  // Handle batch reconcile
  const handleBatchReconcile = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning('Pilih transaksi yang akan direkonsiliasi')
      return
    }

    try {
      const employeeId = currentBranch?.employee_id || 'system'
      const count = await batchReconcile(Array.from(selectedIds), employeeId)
      toast.success(`${count} transaksi berhasil direkonsiliasi`)
      clearSelection()
      fetchTransactions()
      fetchSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal merekonsiliasi transaksi secara batch')
    }
  }, [selectedIds, batchReconcile, toast, currentBranch?.employee_id, clearSelection, fetchTransactions, fetchSummary])

  // Handle generate journal
  const handleGenerateJournal = useCallback(async () => {
    if (!currentBranch?.company_id) {
      toast.error('Company context tidak tersedia')
      return
    }

    setGeneratingJournal(true)
    try {
      await generateJournal({
        company_id: currentBranch.company_id,
        transaction_date_from: journalDateFrom,
        transaction_date_to: journalDateTo,
        include_unreconciled_only: includeUnreconciledOnly,
      })
      toast.success('Jurnal berhasil dibuat dari transaksi yang eligible')
      setShowGenerateJournalModal(false)
      fetchTransactions()
      fetchSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuat jurnal')
    } finally {
      setGeneratingJournal(false)
    }
  }, [generateJournal, toast, currentBranch?.company_id, journalDateFrom, journalDateTo, includeUnreconciledOnly, fetchTransactions, fetchSummary])

  // Handle view detail
  const handleViewDetail = useCallback((id: string) => {
    // Navigate to detail page or open modal
    console.log('View detail:', id)
    // TODO: Navigate to detail page
  }, [])

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
      fetchTransactions()
      fetchSummary()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan transaksi')
    }
  }, [editingId, createTransaction, updateTransaction, toast, fetchTransactions, fetchSummary])

  // Handle form close
  const handleFormClose = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
  }, [])

  // Selected transaction for edit
  const selectedTransaction = editingId 
    ? transactions.find((tx) => tx.id === editingId) || null 
    : null

  // Pagination info
  const showingStart = (page - 1) * limit + 1
  const showingEnd = Math.min(page * limit, total)

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaksi Agregat POS</h1>
          <p className="text-gray-500 mt-1">
            Kelola transaksi agregat dari import POS dan buat jurnal
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchTransactions()
              fetchSummary()
            }}
            className="px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 flex items-center gap-2"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Generate Journal Button */}
          <button
            onClick={() => setShowGenerateJournalModal(true)}
            className="px-3 py-2 text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center gap-2"
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size} transaksi dipilih
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBatchReconcile}
              className="px-3 py-1.5 text-sm text-green-700 bg-green-100 rounded-lg hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-1"
            >
              <CheckCircle className="w-4 h-4" />
              Rekonsiliasi Terpilih
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Batalkan Pilihan
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Transaksi Agregat' : 'Transaksi Agregat Baru'}
              </h2>
              <button
                onClick={handleFormClose}
                className="text-gray-500 hover:text-gray-700 p-1"
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
            onToggleSelection={(id) => usePosAggregatesStore.getState().toggleSelection(id)}
            onToggleAllSelection={() => usePosAggregatesStore.getState().toggleAllSelection()}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between mt-4 gap-4">
              <div className="text-sm text-gray-500">
                Menampilkan {showingStart} - {showingEnd} dari {total} data
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-gray-600">
                  Halaman {page} dari {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Generate Journal Modal */}
      {showGenerateJournalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FilePlus className="w-5 h-5" />
                Buat Jurnal dari Transaksi
              </h2>
              <button
                onClick={() => setShowGenerateJournalModal(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={journalDateFrom}
                  onChange={(e) => setJournalDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={journalDateTo}
                  onChange={(e) => setJournalDateTo(e.target.value)}
                  min={journalDateFrom}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeUnreconciled"
                  checked={includeUnreconciledOnly}
                  onChange={(e) => setIncludeUnreconciledOnly(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="includeUnreconciled" className="text-sm text-gray-700">
                  Hanya transaksi yang belum direkonsiliasi
                </label>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-700">
                  Jurnal akan dibuat dari semua transaksi eligible dalam rentang tanggal yang dipilih.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowGenerateJournalModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleGenerateJournal}
                disabled={generatingJournal || !journalDateFrom || !journalDateTo}
                className="px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {generatingJournal && (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                Buat Jurnal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregatesPage

