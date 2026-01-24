import React, { useEffect, useCallback } from 'react'
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

/**
 * Failed Transactions Page
 * Provides interface to view, fix, and manage failed transactions
 */
export const FailedTransactionsPage: React.FC = () => {
  const navigate = useNavigate()
  const toast = useToast()
  
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

  // Fetch on mount
  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions, page, limit])

  // Handle single fix
  const handleFix = useCallback(async (id: string) => {
    try {
      await fixTransaction(id)
      toast.success('Transaksi berhasil difix dan diproses ulang')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memfix transaksi')
    }
  }, [fixTransaction, toast])

  // Handle batch fix
  const handleBatchFix = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning('Pilih transaksi yang akan difix')
      return
    }

    try {
      const result = await batchFixTransactions(Array.from(selectedIds))
      if (result.fixed.length > 0) {
        toast.success(`${result.fixed.length} transaksi berhasil difix`)
      }
      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} transaksi gagal difix`)
      }
      clearSelection()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memfix transaksi')
    }
  }, [selectedIds, batchFixTransactions, clearSelection, toast])

  // Handle delete
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Yakin ingin menghapus transaksi gagal ini secara permanen?')) {
      return
    }

    try {
      await deleteTransaction(id)
      toast.success('Transaksi gagal dihapus permanen')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus transaksi')
    }
  }, [deleteTransaction, toast])

  // Handle batch delete
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning('Pilih transaksi yang akan dihapus')
      return
    }

    if (!confirm(`Yakin ingin menghapus ${selectedIds.size} transaksi secara permanen?`)) {
      return
    }

    // Delete one by one
    for (const id of selectedIds) {
      try {
        await deleteTransaction(id)
      } catch (error) {
        console.error('Failed to delete:', id, error)
      }
    }

    toast.success('Transaksi terpilih dihapus')
    clearSelection()
  }, [selectedIds, deleteTransaction, clearSelection, toast])

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Format currency
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
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Transaksi Gagal</h1>
          </div>
          <p className="text-gray-500 mt-1">
            Kelola transaksi yang gagal dan coba perbaiki
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm text-red-600 font-medium">Total Gagal</p>
              <p className="text-2xl font-bold text-red-700">{total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-green-600 font-medium">Terpilih</p>
              <p className="text-2xl font-bold text-green-700">{selectedIds.size}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-blue-600 font-medium">Halaman</p>
              <p className="text-2xl font-bold text-blue-700">{page} / {totalPages}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-red-700">
              {selectedIds.size} transaksi dipilih
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBatchFix}
              disabled={isMutating}
              className="px-3 py-1.5 text-sm text-green-700 bg-green-100 rounded-lg hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Fix Terpilih
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={isMutating}
              className="px-3 py-1.5 text-sm text-red-700 bg-red-100 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Hapus Terpilih
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
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
          <span className="ml-3 text-gray-600">Memuat data...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
          <p className="text-gray-600">Tidak ada transaksi gagal</p>
          <p className="text-sm text-gray-500 mt-1">Semua transaksi berhasil diproses</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === transactions.length && transactions.length > 0}
                      onChange={toggleAllSelection}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source Ref</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((tx) => {
                  const isSelected = selectedIds.has(tx.id)
                  
                  return (
                    <tr key={tx.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(tx.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">
                        {tx.source_ref}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.transaction_date}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tx.branch_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatCurrency(tx.net_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate" title="View details for full error">
                        {/* We'll need to fetch details for error message */}
                        Klik untuk lihat error
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleFix(tx.id)}
                            disabled={isMutating}
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg disabled:opacity-50"
                            title="Fix & Retry"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={isMutating}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50"
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

      {/* Info */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-yellow-800 mb-2">Petunjuk:</h3>
        <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
          <li>Klik tombol <RefreshCw className="w-3 h-3 inline" /> untuk memfix dan memproses ulang transaksi</li>
          <li>Klik tombol <Trash2 className="w-3 h-3 inline" /> untuk menghapus transaksi gagal secara permanen</li>
          <li>Pilih beberapa transaksi dan klik "Fix Terpilih" untuk memfix sekaligus</li>
          <li>Untuk melihat detail error, klik pada transaksi (fitur upcoming)</li>
        </ul>
      </div>
    </div>
  )
}

export default FailedTransactionsPage

