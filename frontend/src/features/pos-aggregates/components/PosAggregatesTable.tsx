/**
 * PosAggregatesTable.tsx
 * 
 * Table component for displaying aggregated transactions.
 * Features: selection, sorting, inline actions, loading states, empty states.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Edit2, Trash2, RotateCcw, CheckCircle, FileText, Eye, Building2 } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { PosAggregatesStatusBadge } from './PosAggregatesStatusBadge'
import type { AggregatedTransactionListItem } from '../types'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency to Indonesian Rupiah format
 */
const formatCurrency = (value: number): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0)
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format date to Indonesian format with validation
 */
const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) {
    return '-'
  }
  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// =============================================================================
// PROPS
// =============================================================================

/**
 * Pagination info interface
 */
export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext?: boolean
  hasPrev?: boolean
}

interface PosAggregatesTableProps {
  transactions: AggregatedTransactionListItem[]
  selectedIds: Set<string>
  isLoading?: boolean
  isDeleting?: boolean
  isRestoring?: boolean
  pagination?: PaginationInfo
  onEdit: (id: string) => void
  onDelete: (id: string, sourceRef: string) => void
  onRestore: (id: string, sourceRef: string) => void
  onReconcile: (id: string) => void
  onViewDetail: (id: string) => void
  onSelectBankMutation: (transaction: AggregatedTransactionListItem) => void
  onToggleSelection: (id: string) => void
  onToggleAllSelection: () => void
  onPageChange?: (page: number) => void
  onLimitChange?: (limit: number) => void
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
  isDeleting = false,
  isRestoring = false,
  pagination,
  onEdit,
  onDelete,
  onRestore,
  onReconcile,
  onViewDetail,
  onSelectBankMutation,
  onToggleSelection,
  onToggleAllSelection,
  onPageChange,
  onLimitChange,
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <TableSkeleton rows={10} columns={16} />
      </div>
    )
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Tidak ada transaksi agregat</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Import data POS untuk membuat transaksi agregat</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAllSelection}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tanggal
              </th>
              {/* <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Referensi
              </th> */}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cabang
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Metode Pembayaran
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Sub Total
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tax
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Service Charge
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Discount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Bill After Discount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Fee (%)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Fixed Fee
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Fee
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Nett Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Jurnal
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
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
                    ${isDeleted ? 'bg-red-50 dark:bg-red-900/20 opacity-100' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                    ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
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
                      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {formatDate(transaction.transaction_date)}
                    </span>
                  </td>

                  {/* <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm">
                      <span className="font-mono font-medium text-gray-900">
                        {transaction.source_ref}
                      </span>
                      <div className="text-xs text-gray-500">
                        ID: {transaction.source_id.slice(0, 8)}...
                      </div>
                    </div>
                  </td> */}

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {transaction.branch_name || '-'}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {transaction.payment_method_name || `ID: ${transaction.payment_method_id}`}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(transaction.gross_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      +{formatCurrency(transaction.tax_amount)} 
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      +{formatCurrency(transaction.service_charge_amount || 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm text-red-600 dark:text-red-400">
                      -{formatCurrency(transaction.discount_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatCurrency(transaction.bill_after_discount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm text-purple-600 dark:text-purple-400">
                      -{formatCurrency(transaction.percentage_fee_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm text-purple-600 dark:text-purple-400">
                      -{formatCurrency(transaction.fixed_fee_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                      -{formatCurrency(transaction.total_fee_amount)}
                    </span>
                  </td>
<td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(transaction.nett_amount)}
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
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
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
                    <div className="flex items-center justify-end gap-2" role="group" aria-label="Aksi transaksi">
                      {/* Restore - show this FIRST for deleted items */}
                      {isDeleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRestoreId(transaction.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              setRestoreId(transaction.id)
                            }
                          }}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                          title="Pulihkan"
                          aria-label="Pulihkan transaksi"
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              onViewDetail(transaction.id)
                            }
                          }}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="Lihat Detail"
                          aria-label="Lihat detail transaksi"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {/* Select Bank Mutation - untuk transaksi yang belum direkonsiliasi */}
                      {!isDeleted && !transaction.is_reconciled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectBankMutation(transaction)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              onSelectBankMutation(transaction)
                            }
                          }}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          title="Pilih Mutasi Bank"
                          aria-label="Pilih mutasi bank"
                        >
                          <Building2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Edit */}
                      {!isDeleted && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(transaction.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              onEdit(transaction.id)
                            }
                          }}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="Edit"
                          aria-label="Edit transaksi"
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              onReconcile(transaction.id)
                            }
                          }}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                          title="Rekonsiliasi"
                          aria-label="Rekonsiliasi transaksi"
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              setDeleteId(transaction.id)
                            }
                          }}
                          className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                          title="Hapus"
                          aria-label="Hapus transaksi"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black/70 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 id="delete-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Hapus Transaksi Agregat?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Apakah Anda yakin ingin menghapus transaksi agregat ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const tx = transactions.find((t) => t.id === deleteId)
                  if (tx) handleDelete(deleteId, tx.source_ref)
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black/70 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="restore-modal-title">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 id="restore-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Pulihkan Transaksi Agregat?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Apakah Anda yakin ingin memulihkan transaksi agregat ini?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreId(null)}
                disabled={isRestoring}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const tx = transactions.find((t) => t.id === restoreId)
                  if (tx) handleRestore(restoreId, tx.source_ref)
                }}
                disabled={isRestoring}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRestoring && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isRestoring ? 'Memulihkan...' : 'Pulihkan'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Pagination - Using Global Component */}
      {pagination && pagination.totalPages > 0 && (
        <div className="mt-4">
          <Pagination
            pagination={pagination}
            onPageChange={onPageChange || (() => {})}
            onLimitChange={onLimitChange}
            currentLength={transactions.length}
          />
        </div>
      )}
    </>
  )
}

// Using global Pagination component from @/components/ui/Pagination

export default PosAggregatesTable

