import { useState } from 'react'
import { Edit2, Trash2, RotateCcw } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PaymentMethodStatusBadge } from './PaymentMethodStatusBadge'
import type { PaymentMethod } from '../types'

interface PaymentMethodTableProps {
  paymentMethods: PaymentMethod[]
  onEdit: (id: number) => void
  onDelete: (id: number, name: string) => void
  onRestore: (id: number, name: string) => void
  loading?: boolean
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  BANK: 'Bank',
  CARD: 'Card',
  CASH: 'Cash',
  COMPLIMENT: 'Compliment',
  MEMBER_DEPOSIT: 'Member Deposit',
  OTHER_COST: 'Other Cost'
}

export const PaymentMethodTable = ({ 
  paymentMethods, 
  onEdit, 
  onDelete, 
  onRestore, 
  loading 
}: PaymentMethodTableProps) => {
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [restoreId, setRestoreId] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <TableSkeleton rows={5} columns={5} />
      </div>
    )
  }

  if (paymentMethods.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="mt-2 text-gray-500 font-medium">No payment methods</p>
        <p className="text-sm text-gray-400">Create a new payment method to get started</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paymentMethods.map(method => {
              const isDeleted = !!method.deleted_at
              return (
                <tr 
                  key={method.id}
                  className={`transition-colors ${
                    isDeleted 
                      ? 'bg-gray-50 opacity-60' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono font-medium text-gray-900">{method.code}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{method.name}</div>
                    {method.description && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">{method.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">
                      {PAYMENT_TYPE_LABELS[method.payment_type] || method.payment_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {method.bank_name ? (
                      <div className="text-sm">
                        <span className="text-gray-900">{method.bank_name}</span>
                        {method.account_number && (
                          <span className="text-gray-500 ml-1">({method.account_number})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <PaymentMethodStatusBadge 
                      isActive={method.is_active} 
                      isDefault={method.is_default}
                      isDeleted={isDeleted}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      {!isDeleted && (
                        <>
                          <button 
                            onClick={() => onEdit(method.id)} 
                            className="text-blue-600 hover:text-blue-900 transition-colors flex items-center gap-1"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteId(method.id)} 
                            className="text-red-600 hover:text-red-900 transition-colors flex items-center gap-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {isDeleted && (
                        <button 
                          onClick={() => setRestoreId(method.id)} 
                          className="text-green-600 hover:text-green-900 transition-colors flex items-center gap-1"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Payment Method?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this payment method? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const method = paymentMethods.find(m => m.id === deleteId)
                  if (method) onDelete(deleteId, method.name)
                  setDeleteId(null)
                }}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Restore Payment Method?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to restore this payment method?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const method = paymentMethods.find(m => m.id === restoreId)
                  if (method) onRestore(restoreId, method.name)
                  setRestoreId(null)
                }}
                className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

