/**
 * FailedTransactionsTable.tsx
 * 
 * Table component for displaying failed transactions.
 * Features: selection, inline actions, loading states, empty states.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { RefreshCw, Trash2, Eye, AlertTriangle } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import type { AggregatedTransactionListItem } from '../types'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency to Indonesian Rupiah format
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format date to Indonesian format
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// =============================================================================
// PROPS
// =============================================================================

interface FailedTransactionsTableProps {
  transactions: AggregatedTransactionListItem[]
  selectedIds: Set<string>
  isLoading?: boolean
  onFix: (id: string) => void
  onDelete: (id: string) => void
  onViewDetail: (id: string) => void
  onToggleSelection: (id: string) => void
  onToggleAllSelection: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Table component for displaying failed transactions
 * Supports selection, inline actions, and various states
 */
export const FailedTransactionsTable: React.FC<FailedTransactionsTableProps> = ({
  transactions,
  selectedIds,
  isLoading = false,
  onFix,
  onDelete,
  onViewDetail,
  onToggleSelection,
  onToggleAllSelection,
}) => {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Check if all transactions are selected
  const allSelected = useMemo(() => {
    if (transactions.length === 0) return false
    return transactions.every((tx) => selectedIds.has(tx.id))
  }, [transactions, selectedIds])

  // Handle delete confirmation
  const handleDelete = useCallback((id: string) => {
    setDeleteId(null)
    onDelete(id)
  }, [onDelete])

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <TableSkeleton rows={10} columns={8} />
      </div>
    )
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <AlertTriangle className="mx-auto h-12 w-12 text-green-500" />
        <p className="mt-2 text-gray-500 font-medium">Tidak ada transaksi gagal</p>
        <p className="text-sm text-gray-400">Semua transaksi berhasil diproses</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Checkbox */}
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAllSelection}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
              {/* Transaction Date */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tanggal
              </th>
              {/* Source Ref */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Referensi
              </th>
              {/* Branch */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cabang
              </th>
              {/* Amount */}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              {/* Error */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Error
              </th>
              {/* Actions */}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((transaction) => {
              const isSelected = selectedIds.has(transaction.id)
              
              return (
                <tr
                  key={transaction.id}
                  className={`
                    transition-colors
                    hover:bg-gray-50
                    ${isSelected ? 'bg-red-50' : ''}
                  `}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelection(transaction.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>

                  {/* Transaction Date */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {formatDate(transaction.transaction_date)}
                    </span>
                  </td>

                  {/* Source Ref */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm">
                      <span className="font-mono font-medium text-gray-900">
                        {transaction.source_ref}
                      </span>
                    </div>
                  </td>

                  {/* Branch */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {transaction.branch_name || '-'}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(transaction.net_amount)}
                    </span>
                  </td>

                  {/* Error */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewDetail(transaction.id)}
                      className="text-sm text-red-600 max-w-xs truncate block hover:underline cursor-pointer text-left"
                      title="Klik untuk lihat detail error"
                    >
                      Klik untuk lihat detail
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* View Detail */}
                      <button
                        onClick={() => onViewDetail(transaction.id)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Fix */}
                      <button
                        onClick={() => onFix(transaction.id)}
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Fix & Retry"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteId(transaction.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <DeleteConfirmModal
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </>
  )
}

// =============================================================================
// DELETE CONFIRMATION MODAL
// =============================================================================

interface DeleteConfirmModalProps {
  onConfirm: () => void
  onCancel: () => void
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  onConfirm,
  onCancel,
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Hapus Transaksi Gagal?</h3>
      <p className="text-gray-600 mb-6">
        Apakah Anda yakin ingin menghapus transaksi gagal ini secara permanen? Tindakan ini tidak dapat dibatalkan.
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Hapus
        </button>
      </div>
    </div>
  </div>
)

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default FailedTransactionsTable

