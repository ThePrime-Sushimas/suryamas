/**
 * PosAggregateDetailPage.tsx
 * 
 * Full page for viewing aggregated transaction details.
 * Displays comprehensive transaction information.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, Loader2, Edit2, Trash2, RotateCcw, CheckCircle } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContextStore } from '@/features/branch_context'
import { PosAggregatesDetail } from '../components/PosAggregatesDetail'

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
  } = usePosAggregatesStore()

  const [initialLoad, setInitialLoad] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Fetch transaction on mount
  useEffect(() => {
    if (!id) {
      toast.error('ID transaksi tidak valid')
      navigate('/pos-aggregates')
      return
    }

    const loadTransaction = async () => {
      try {
        await fetchTransactionById(id)
      } catch (error) {
        if (error instanceof Error && error.message.includes('tidak ditemukan')) {
          toast.error('Transaksi tidak ditemukan atau telah dihapus')
        } else {
          toast.error('Gagal mengambil data transaksi')
        }
        navigate('/pos-aggregates')
      } finally {
        setInitialLoad(false)
      }
    }

    loadTransaction()
  }, [id, fetchTransactionById, toast, navigate])

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!id || !selectedTransaction) return

    try {
      await deleteTransaction(id)
      toast.success(`Transaksi "${selectedTransaction.source_ref}" berhasil dihapus`)
      fetchSummary()
      navigate('/pos-aggregates')
    } catch {
      toast.error('Gagal menghapus transaksi')
    } finally {
      setDeleteId(null)
    }
  }, [id, selectedTransaction, deleteTransaction, toast, fetchSummary, navigate])

  // Handle restore
  const handleRestore = useCallback(async () => {
    if (!id || !selectedTransaction) return

    try {
      await restoreTransaction(id)
      toast.success(`Transaksi "${selectedTransaction.source_ref}" berhasil dipulihkan`)
      fetchTransactions()
      fetchSummary()
      navigate('/pos-aggregates')
    } catch {
      toast.error('Gagal memulihkan transaksi')
    }
  }, [id, selectedTransaction, restoreTransaction, toast, fetchTransactions, fetchSummary, navigate])

  // Handle reconcile
  const handleReconcile = useCallback(async () => {
    if (!id) return

    try {
      const employeeId = currentBranch?.employee_id || 'system'
      await reconcileTransaction(id, employeeId)
      toast.success('Transaksi berhasil direkonsiliasi')
      fetchTransactionById(id)
      fetchSummary()
    } catch {
      toast.error('Gagal merekonsiliasi transaksi')
    }
  }, [id, reconcileTransaction, toast, currentBranch?.employee_id, fetchTransactionById, fetchSummary])

  // Loading state
  if (initialLoad) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Detail Transaksi Agregat</h1>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Memuat data transaksi...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !selectedTransaction) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Detail Transaksi Agregat</h1>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-12 text-center">
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

  const isDeleted = selectedTransaction.status === 'CANCELLED'
  const canReconcile = !isDeleted && !selectedTransaction.is_reconciled && selectedTransaction.journal_id

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Detail Transaksi Agregat</h1>
            <p className="text-gray-500 mt-1">
              {selectedTransaction.source_ref} • {selectedTransaction.branch_name || 'Tanpa Cabang'}
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {!isDeleted && (
            <>
              {canReconcile && (
                <button
                  onClick={handleReconcile}
                  className="px-3 py-2 text-green-700 bg-green-100 rounded-lg hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Rekonsiliasi
                </button>
              )}
              <button
                onClick={() => navigate(`/pos-aggregates/${id}/edit`)}
                className="px-3 py-2 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => setDeleteId(id || null)}
                className="px-3 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Hapus
              </button>
            </>
          )}
          {isDeleted && (
            <button
              onClick={handleRestore}
              className="px-3 py-2 text-green-700 bg-green-100 rounded-lg hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Pulihkan
            </button>
          )}
        </div>
      </div>

      {/* Detail Card */}
      <div className="bg-white rounded-lg shadow">
        <PosAggregatesDetail transaction={selectedTransaction} />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Hapus Transaksi Agregat?</h3>
              <button
                onClick={() => setDeleteId(null)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-600">
                Apakah Anda yakin ingin menghapus transaksi agregat ini? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Hapus
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

export default PosAggregateDetailPage

