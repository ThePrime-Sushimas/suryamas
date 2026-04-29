import React, { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  AlertTriangle, 
  RotateCcw, 
  Trash2, 
  RefreshCw, 
  ArrowLeft,
  CheckCircle
} from 'lucide-react'
import { useFailedTransactionsStore } from '../store/failedTransactions.store'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FailedTransactionDetailModal } from '../components/FailedTransactionDetailModal'
import { FAILED_TRANSACTIONS_MESSAGES } from '@/utils/messages'

export const FailedTransactionsPage: React.FC = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)
  
  const {
    transactions,
    selectedIds,
    page,
    limit,
    total,
    totalPages,
    isLoading,
    isMutating,
    fetchTransactions,
    fixTransaction,
    batchFixTransactions,
    deleteTransaction,
    setPage,
    toggleSelection,
    toggleAllSelection,
    clearSelection,
  } = useFailedTransactionsStore()

  useEffect(() => {
    fetchTransactions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewDetail = useCallback((id: string) => {
    setSelectedTransactionId(id)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedTransactionId(null)
  }, [])

  const handleFix = useCallback(async (id: string) => {
    try {
      await fixTransaction(id)
      toast.success(FAILED_TRANSACTIONS_MESSAGES.TRANSACTION_FIXED)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : FAILED_TRANSACTIONS_MESSAGES.TRANSACTION_FIX_FAILED)
    }
  }, [fixTransaction, toast])

  const handleDeleteFromModal = useCallback(async (id: string) => {
    try {
      await deleteTransaction(id)
      toast.success(FAILED_TRANSACTIONS_MESSAGES.TRANSACTION_DELETED)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : FAILED_TRANSACTIONS_MESSAGES.TRANSACTION_DELETE_FAILED)
    }
  }, [deleteTransaction, toast])

  const handleBatchFix = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning(FAILED_TRANSACTIONS_MESSAGES.NO_FAILED_TRANSACTIONS)
      return
    }

    try {
      const result = await batchFixTransactions(Array.from(selectedIds))
      if (result.fixed.length > 0) {
        toast.success(FAILED_TRANSACTIONS_MESSAGES.TRANSACTION_FIXED_BATCH(result.fixed.length))
      }
      if (result.failed.length > 0) {
        toast.warning(FAILED_TRANSACTIONS_MESSAGES.BATCH_FIX_WARNING(result.failed.length))
      }
      clearSelection()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : FAILED_TRANSACTIONS_MESSAGES.TRANSACTION_FIX_FAILED)
    }
  }, [selectedIds, batchFixTransactions, clearSelection, toast])

  const handleDelete = useCallback(async (id: string) => {
    setDeleteTarget(id)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteTransaction(deleteTarget)
      toast.success(FAILED_TRANSACTIONS_MESSAGES.TRANSACTION_DELETED)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : FAILED_TRANSACTIONS_MESSAGES.TRANSACTION_DELETE_FAILED)
    } finally {
      setDeleteTarget(null)
    }
  }, [deleteTarget, deleteTransaction, toast])

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning(FAILED_TRANSACTIONS_MESSAGES.NO_FAILED_TRANSACTIONS)
      return
    }
    setBatchDeleteConfirm(true)
  }, [selectedIds, toast])

  const confirmBatchDelete = useCallback(async () => {
    for (const id of selectedIds) {
      try {
        await deleteTransaction(id)
      } catch (error) {
        console.error('Failed to delete:', id, error)
      }
    }
    toast.success(FAILED_TRANSACTIONS_MESSAGES.TRANSACTION_SELECTED_DELETED)
    clearSelection()
    setBatchDeleteConfirm(false)
  }, [selectedIds, deleteTransaction, clearSelection, toast])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const showingStart = (page - 1) * limit + 1
  const showingEnd = Math.min(page * limit, total)

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate('/pos-aggregates')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transaksi Gagal</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola transaksi yang gagal dan coba perbaiki
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Total Gagal</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Terpilih</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{selectedIds.size}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Halaman</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{page} / {totalPages}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              {selectedIds.size} transaksi dipilih
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBatchFix}
              disabled={isMutating}
              className="px-3 py-1.5 text-sm text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Fix Terpilih
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={isMutating}
              className="px-3 py-1.5 text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Hapus Terpilih
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Batalkan
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Memuat data...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 dark:text-green-400" />
          <p className="text-gray-600 dark:text-gray-300">Tidak ada transaksi gagal</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Semua transaksi berhasil diproses</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === transactions.length && transactions.length > 0}
                      onChange={toggleAllSelection}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source Ref</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Branch</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Error</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((tx) => {
                  const isSelected = selectedIds.has(tx.id)
                  
                  return (
                    <tr key={tx.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isSelected ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(tx.id)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                        {tx.source_ref}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {tx.transaction_date}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {tx.branch_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(tx.nett_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewDetail(tx.id)}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline cursor-pointer text-left"
                          title="Klik untuk lihat detail error"
                        >
                          Klik untuk lihat detail
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDetail(tx.id)}
                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Lihat Detail"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleFix(tx.id)}
                            disabled={isMutating}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg disabled:opacity-50"
                            title="Fix & Retry"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={isMutating}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50"
                            title="Hapus Permanen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

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
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Halaman {page} dari {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Info */}
      <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">Petunjuk:</h3>
        <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
          <li>Klik tombol <RefreshCw className="w-3 h-3 inline" /> untuk reset dan memproses ulang transaksi</li>
          <li>Klik tombol <Trash2 className="w-3 h-3 inline" /> untuk menghapus transaksi gagal secara permanen</li>
          <li>Pilih beberapa transaksi dan klik "Fix Terpilih" untuk reset sekaligus</li>
          <li>Klik pada kolom "Error" atau tombol <AlertTriangle className="w-3 h-3 inline" /> untuk melihat detail error transaksi</li>
        </ul>
      </div>

      {/* Failed Transaction Detail Modal */}
      {selectedTransactionId && (
        <FailedTransactionDetailModal
          transactionId={selectedTransactionId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onFix={handleFix}
          onDelete={handleDeleteFromModal}
        />
      )}

      {/* Delete Single Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Hapus Transaksi"
        message="Yakin ingin menghapus transaksi gagal ini secara permanen?"
        confirmText="Hapus"
        variant="danger"
      />

      {/* Batch Delete Confirm */}
      <ConfirmModal
        isOpen={batchDeleteConfirm}
        onClose={() => setBatchDeleteConfirm(false)}
        onConfirm={confirmBatchDelete}
        title="Hapus Transaksi Terpilih"
        message={`Yakin ingin menghapus ${selectedIds.size} transaksi secara permanen?`}
        confirmText="Hapus Semua"
        variant="danger"
      />
    </div>
  )
}

export default FailedTransactionsPage
