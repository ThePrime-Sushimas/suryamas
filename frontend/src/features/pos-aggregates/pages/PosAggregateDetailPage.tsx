/**
 * PosAggregateDetailPage.tsx
 *
 * Full page for viewing aggregated transaction details.
 * Displays comprehensive transaction information.
 *
 * UX Improvements:
 * - Sticky action bar at bottom so actions are always accessible
 * - Copy button for ID/ref fields to reduce friction
 * - Delete modal shows transaction ref for safety confirmation
 * - Print button moved to header area
 * - Fixed typo: 'Tanpa Cabrera' -> 'Tanpa Cabang'
 */

import React, { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Edit2, Trash2, RotateCcw, CheckCircle, Building2, Printer, Zap } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContextStore } from '@/features/branch_context'
import { PosAggregatesDetail } from '../components/PosAggregatesDetail'
import { BankMutationSelectorModal } from '../components/BankMutationSelectorModal'
import { bankReconciliationApi } from '../../bank-reconciliation/api/bank-reconciliation.api'
import { POS_AGGREGATES_MESSAGES, BANK_RECONCILIATION_MESSAGES } from '@/utils/messages'
import { mapToAggregatedTransactionListItem, canReconcileTransaction, canMatchBankMutation } from '../types'
import { posSyncAggregatesApi } from '@/features/pos-sync-aggregates/api/pos-sync-aggregates.api'
import type { PosSyncAggregateLine } from '@/features/pos-sync-aggregates/types/pos-sync-aggregates.types'

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Full page for viewing aggregated transaction details
 * Displays comprehensive transaction information with actions
 */
export const PosAggregateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const currentBranch = useBranchContextStore((s) => s.currentBranch)

  const {
    selectedTransaction,
    fetchTransactionById,
    deleteTransaction,
    restoreTransaction,
    reconcileTransaction,
    fetchTransactions,
    fetchSummary,
    error,
    inFlightRequests,
  } = usePosAggregatesStore()

  const [initialLoad, setInitialLoad] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showMutationSelector, setShowMutationSelector] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [posSyncLines, setPosSyncLines] = useState<PosSyncAggregateLine[]>([])
  const [isLoadingLines, setIsLoadingLines] = useState(false)

  // Fetch transaction on mount - only if not already loaded
  useEffect(() => {
    if (!id) {
      toast.error(POS_AGGREGATES_MESSAGES.INVALID_TRANSACTION_ID)
      navigate('/pos-aggregates')
      return
    }

    // Skip fetch if already loaded with same ID
    if (selectedTransaction && selectedTransaction.id === id) {
      setInitialLoad(false)
      return
    }

    const loadTransaction = async () => {
      try {
        await fetchTransactionById(id)
      } catch (error) {
        if (error instanceof Error && error.message.includes('tidak ditemukan')) {
          toast.error(POS_AGGREGATES_MESSAGES.TRANSACTION_NOT_FOUND)
        } else {
          toast.error(POS_AGGREGATES_MESSAGES.TRANSACTION_FETCH_FAILED)
        }
        navigate('/pos-aggregates')
      } finally {
        setInitialLoad(false)
      }
    }

    loadTransaction()
  }, [id, fetchTransactionById, toast, navigate, selectedTransaction])

  // Fetch POS Sync lines jika source_type === 'POS_SYNC'
  useEffect(() => {
    if (!selectedTransaction) return
    if (selectedTransaction.source_type !== 'POS_SYNC') {
      setPosSyncLines([])
      return
    }
    const posSyncId = selectedTransaction.source_id
    if (!posSyncId) return

    setIsLoadingLines(true)
    posSyncAggregatesApi
      .getLines(posSyncId)
      .then(setPosSyncLines)
      .catch((err) => console.error('Failed to fetch pos sync lines:', err))
      .finally(() => setIsLoadingLines(false))
  }, [selectedTransaction?.id, selectedTransaction?.source_type, selectedTransaction?.source_id])

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!id || !selectedTransaction) return

    setIsDeleting(true)
    try {
      await deleteTransaction(id)
      toast.success(POS_AGGREGATES_MESSAGES.TRANSACTION_DELETED(selectedTransaction.source_ref))
      fetchSummary()
      navigate('/pos-aggregates')
    } catch {
      toast.error(POS_AGGREGATES_MESSAGES.TRANSACTION_DELETE_FAILED)
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }, [id, selectedTransaction, deleteTransaction, toast, fetchSummary, navigate])

  // Handle restore
  const handleRestore = useCallback(async () => {
    if (!id || !selectedTransaction) return

    try {
      await restoreTransaction(id)
      toast.success(POS_AGGREGATES_MESSAGES.TRANSACTION_RESTORED(selectedTransaction.source_ref))
      fetchTransactions()
      fetchSummary()
      navigate('/pos-aggregates')
    } catch {
      toast.error(POS_AGGREGATES_MESSAGES.TRANSACTION_RESTORE_FAILED)
    }
  }, [id, selectedTransaction, restoreTransaction, toast, fetchTransactions, fetchSummary, navigate])

  // Handle reconcile
  const handleReconcile = useCallback(async () => {
    if (!id) return

    try {
      const employeeId = currentBranch?.employee_id || 'system'
      await reconcileTransaction(id, employeeId)
      toast.success(POS_AGGREGATES_MESSAGES.TRANSACTION_RECONCILED)

      // Only fetch if there's no in-flight request for this transaction
      const inFlightKey = `fetchTransactionById:${id}`
      if (!inFlightRequests.has(inFlightKey)) {
        fetchTransactionById(id)
      }
      fetchSummary()
    } catch {
      toast.error(POS_AGGREGATES_MESSAGES.TRANSACTION_RECONCILE_FAILED)
    }
  }, [id, reconcileTransaction, toast, currentBranch?.employee_id, fetchTransactionById, fetchSummary, inFlightRequests])

  // Handle open mutation selector
  const handleOpenMutationSelector = useCallback(() => {
    if (!canMatchBankMutation(selectedTransaction)) {
      toast.warning(POS_AGGREGATES_MESSAGES.TRANSACTION_ALREADY_RECONCILED)
      return
    }
    setShowMutationSelector(true)
  }, [selectedTransaction, toast])

  // Handle confirm bank mutation match
  const handleConfirmMutationMatch = useCallback(async (statementId: string) => {
    if (!id || !selectedTransaction) return

    try {
      setIsMatching(true)
      await bankReconciliationApi.manualReconcile({
        aggregateId: id,
        statementId,
      })
      toast.success(BANK_RECONCILIATION_MESSAGES.BANK_MUTATION_MATCHED)

      // Only fetch if there's no in-flight request for this transaction
      const inFlightKey = `fetchTransactionById:${id}`
      if (!inFlightRequests.has(inFlightKey)) {
        await fetchTransactionById(id)
      }

      setShowMutationSelector(false)
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } }; message?: string }
      toast.error(err.response?.data?.message || err.message || BANK_RECONCILIATION_MESSAGES.MATCH_FAILED)
    } finally {
      setIsMatching(false)
    }
  }, [id, selectedTransaction, fetchTransactionById, toast, inFlightRequests])

  // Loading state
  if (initialLoad) {
    return (
      <div className="p-6 space-y-6 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Detail Transaksi Agregat</h1>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Memuat data transaksi...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !selectedTransaction) {
    return (
      <div className="p-6 space-y-6 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Detail Transaksi Agregat</h1>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-red-600 mb-4">{error || 'Transaksi tidak ditemukan'}</p>
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Kembali ke Daftar
          </button>
        </div>
      </div>
    )
  }

  const transaction = selectedTransaction!
  const canReconcile = canReconcileTransaction(transaction)

  return (
    // pb-24 to leave room for sticky action bar
    <div className="p-6 space-y-6 dark:bg-gray-900 pb-24">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Detail Transaksi Agregat</h1>
            {/* FIX: typo 'Cabrera' → 'Cabang' */}
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {transaction.source_ref} • {transaction.branch_name || 'Tanpa Cabang'}
              {transaction.source_type === 'POS_SYNC' && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold">
                  <Zap className="w-3 h-3" />
                  Auto Sync
                </span>
              )}
              {transaction.source_type === 'POS' && (
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-semibold">
                  Manual Import
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Secondary actions visible in header: only Print (non-destructive) */}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors text-sm font-medium"
        >
          <Printer className="w-4 h-4" />
          Cetak
        </button>
      </div>

      {/* ── Detail Card ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <PosAggregatesDetail transaction={transaction} />
      </div>

      {/* ── POS Sync Lines (hanya jika source_type = POS_SYNC) ─────── */}
      {transaction.source_type === 'POS_SYNC' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Link ke POS Sync detail page */}
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/10 border-b dark:border-gray-700 flex items-center justify-between">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Transaksi ini berasal dari POS Auto Sync
            </p>
            <button
              onClick={() => navigate(`/pos-sync-aggregates/${transaction.source_id}`)}
              className="text-xs text-blue-700 dark:text-blue-300 font-semibold hover:underline flex items-center gap-1"
            >
              Lihat Detail POS Sync
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Detail Transaksi POS
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Data langsung dari sistem POS ·{' '}
                {isLoadingLines ? '...' : `${posSyncLines.length} bills`}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-semibold">
              <Zap className="w-3 h-3" />
              Auto Sync
            </span>
          </div>

          {isLoadingLines ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-3 text-sm text-gray-500">Memuat detail transaksi...</span>
            </div>
          ) : posSyncLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <p className="text-sm">Tidak ada detail transaksi ditemukan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    {['No. Sales', 'Subtotal', 'Diskon', 'Tax (PPN)', 'Grand Total', 'Pembayaran'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {posSyncLines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-900 dark:text-white">
                        {line.sales_num}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {Number(line.subtotal).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {Number(line.discount_total) > 0 ? Number(line.discount_total).toLocaleString('id-ID') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {Number(line.vat_total).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                        {Number(line.grand_total).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">
                        {Number(line.payment_amount).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-600">
                  <tr>
                    <td className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">
                      Total ({posSyncLines.length} bills)
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {posSyncLines.reduce((s, l) => s + Number(l.subtotal), 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {posSyncLines.reduce((s, l) => s + Number(l.discount_total), 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {posSyncLines.reduce((s, l) => s + Number(l.vat_total), 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {posSyncLines.reduce((s, l) => s + Number(l.grand_total), 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400">
                      {posSyncLines.reduce((s, l) => s + Number(l.payment_amount), 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sticky Action Bar ───────────────────────────────────────────── */}
      {/* Always visible at bottom so user can act without scrolling back up */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          {/* Left: context info */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 truncate">
            <span className="font-mono truncate max-w-[200px]">{transaction.source_ref}</span>
            <span>•</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                transaction.status === 'COMPLETED'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : transaction.status === 'CANCELLED'
                    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
              }`}
            >
              {transaction.status}
            </span>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 ml-auto">
            {transaction.status !== 'CANCELLED' && (
              <>
                {canReconcile && (
                  <button
                    onClick={handleReconcile}
                    className="px-3 py-2 text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2 text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Rekonsiliasi</span>
                  </button>
                )}
                {canMatchBankMutation(transaction) && (
                  <button
                    onClick={handleOpenMutationSelector}
                    className="px-3 py-2 text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 text-sm font-medium"
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Pilih Mutasi Bank</span>
                  </button>
                )}
                {transaction.source_type !== 'POS_SYNC' && (
                  <button
                    onClick={() => navigate(`/pos-aggregates/${id}/edit`)}
                    className="px-3 py-2 text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 text-sm font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                )}
                {transaction.source_type !== 'POS_SYNC' && (
                  <button
                    onClick={() => setDeleteId(id || null)}
                    className="px-3 py-2 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center gap-2 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Hapus</span>
                  </button>
                )}
              </>
            )}
            {transaction.status === 'CANCELLED' && (
              <button
                onClick={handleRestore}
                className="px-3 py-2 text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2 text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Pulihkan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      {/* IMPROVEMENT: shows source_ref in modal so user confirms the right record */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Hapus Transaksi Agregat?</h3>
              <button
                onClick={() => setDeleteId(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-gray-600 dark:text-gray-300">
                Apakah Anda yakin ingin menghapus transaksi ini?
              </p>
              {/* Show identifier so user double-checks they're deleting the right record */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="text-xs text-red-600 dark:text-red-400 font-semibold uppercase mb-1">Referensi Transaksi</div>
                <div className="font-mono text-sm text-red-800 dark:text-red-200 font-bold">
                  {transaction.source_ref}
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tindakan ini tidak dapat dibatalkan secara permanen.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setDeleteId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-red-400 flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bank Mutation Selector Modal ─────────────────────────────────── */}
      <BankMutationSelectorModal
        isOpen={showMutationSelector}
        onClose={() => setShowMutationSelector(false)}
        onConfirm={handleConfirmMutationMatch}
        aggregate={mapToAggregatedTransactionListItem(transaction)}
        isLoading={isMatching}
      />
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default PosAggregateDetailPage
