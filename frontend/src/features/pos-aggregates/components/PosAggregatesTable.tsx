/**
 * PosAggregatesTable.tsx
 * 
 * Table component for displaying aggregated transactions.
 * Features: selection, sorting, inline actions, loading states, empty states.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Edit2, Trash2, RotateCcw, CheckCircle, FileText, Eye } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PosAggregatesStatusBadge } from './PosAggregatesStatusBadge'
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
  })
}

// =============================================================================
// PROPS
// =============================================================================

interface PosAggregatesTableProps {
  transactions: AggregatedTransactionListItem[]
  selectedIds: Set<string>
  isLoading?: boolean
  onEdit: (id: string) => void
  onDelete: (id: string, sourceRef: string) => void
  onRestore: (id: string, sourceRef: string) => void
  onReconcile: (id: string) => void
  onViewDetail: (id: string) => void
  onToggleSelection: (id: string) => void
  onToggleAllSelection: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Table component for displaying aggregated transactions
 * Supports selection, inline actions, and various states
 */
export const PosAggregatesTable: React.FC<PosAggregatesTableProps> = ({
  transactions,
  selectedIds,
  isLoading = false,
  onEdit,
  onDelete,
  onRestore,
  onReconcile,
  onViewDetail,
  onToggleSelection,
  onToggleAllSelection,
}) => {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [restoreId, setRestoreId] = useState<string | null>(null)

  // Check if all transactions are selected
  const allSelected = useMemo(() => {
    if (transactions.length === 0) return false
    return transactions.every((tx) => selectedIds.has(tx.id))
  }, [transactions, selectedIds])

  // Handle delete confirmation
  const handleDelete = useCallback((id: string, sourceRef: string) => {
    setDeleteId(null)
    onDelete(id, sourceRef)
  }, [onDelete])

  // Handle restore confirmation
  const handleRestore = useCallback((id: string, sourceRef: string) => {
    setRestoreId(null)
    onRestore(id, sourceRef)
  }, [onRestore])

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <TableSkeleton rows={10} columns={9} />
      </div>
    )
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p className="mt-2 text-gray-500 font-medium">Tidak ada transaksi agregat</p>
        <p className="text-sm text-gray-400">Import data POS untuk membuat transaksi agregat</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAllSelection}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tanggal
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Referensi
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cabang
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Metode Pembayaran
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sub Total
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tax
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Discount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bill After Discount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jurnal
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((transaction) => {
              // Explicitly check deleted_at - handle edge cases
              const deletedAt = transaction.deleted_at
              const isDeleted = deletedAt !== null && deletedAt !== undefined && deletedAt !== ''
              const isSelected = selectedIds.has(transaction.id)
              
              return (
                <tr
                  key={transaction.id}
                  onClick={() => onViewDetail(transaction.id)}
                  className={`
                    cursor-pointer transition-colors
                    ${isDeleted ? 'bg-red-50 opacity-100' : 'hover:bg-blue-50'}
                    ${isSelected ? 'bg-blue-100' : ''}
                  `}
                >
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelection(transaction.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {formatDate(transaction.transaction_date)}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm">
                      <span className="font-mono font-medium text-gray-900">
                        {transaction.source_ref}
                      </span>
                      <div className="text-xs text-gray-500">
                        ID: {transaction.source_id.slice(0, 8)}...
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {transaction.branch_name || '-'}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-600">
                      {transaction.payment_method_name || `ID: ${transaction.payment_method_id}`}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(transaction.gross_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm text-gray-600">
                      +{formatCurrency(transaction.tax_amount)} 
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm text-red-600">
                      -{formatCurrency(transaction.discount_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(transaction.net_amount)}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <PosAggregatesStatusBadge
                      status={transaction.status}
                      showReconciled
                      isReconciled={transaction.is_reconciled}
                    />
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    {transaction.journal_number ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
                        <FileText className="w-3 h-3" />
                        {transaction.journal_number}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>

                  <td
                    className="px-4 py-3 whitespace-nowrap text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {/* Restore - show this FIRST for deleted items */}
                      {isDeleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRestoreId(transaction.id)
                          }}
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Pulihkan"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}

                      {/* View Detail */}
                      {!isDeleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewDetail(transaction.id)
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {/* Edit */}
                      {!isDeleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(transaction.id)
                          }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Reconcile */}
                      {!isDeleted && !transaction.is_reconciled && transaction.journal_number && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onReconcile(transaction.id)
                          }}
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Rekonsiliasi"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete */}
                      {!isDeleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteId(transaction.id)
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Hapus Transaksi Agregat?</h3>
            <p className="text-gray-600 mb-6">Apakah Anda yakin ingin menghapus transaksi agregat ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const tx = transactions.find((t) => t.id === deleteId)
                  if (tx) handleDelete(deleteId, tx.source_ref)
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Pulihkan Transaksi Agregat?</h3>
            <p className="text-gray-600 mb-6">Apakah Anda yakin ingin memulihkan transaksi agregat ini?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const tx = transactions.find((t) => t.id === restoreId)
                  if (tx) handleRestore(restoreId, tx.source_ref)
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Pulihkan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PosAggregatesTable

