import { Edit2, Trash2, RotateCcw } from 'lucide-react'
import type { PaymentTerm, CalculationType } from '../types'
import { PaymentTermStatusBadge } from './PaymentTermStatusBadge'

interface PaymentTermTableProps {
  paymentTerms: PaymentTerm[]
  onEdit: (id: number) => void
  onDelete: (id: number, termName: string) => void
  onRestore: (id: number, termName: string) => void
  loading?: boolean
}

const CALCULATION_TYPE_LABELS: Record<CalculationType, string> = {
  from_invoice: 'From Invoice',
  from_delivery: 'From Delivery',
  fixed_date: 'Fixed Dates',
  fixed_date_immediate: 'Fixed Dates (Immediate)',
  weekly: 'Weekly',
  monthly: 'Monthly'
}

export const PaymentTermTable = ({ 
  paymentTerms, 
  onEdit, 
  onDelete, 
  onRestore, 
  loading 
}: PaymentTermTableProps) => {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading payment terms...</p>
      </div>
    )
  }

  if (paymentTerms.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="mt-2 text-gray-500 font-medium">No payment terms found</p>
        <p className="text-sm text-gray-400">Create a new payment term to get started</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Term Code
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Term Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Calculation Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Days
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
          {paymentTerms.map(term => {
            const isDeleted = !!term.deleted_at
            return (
              <tr 
                key={term.id} 
                className={`transition-colors ${
                  isDeleted 
                    ? 'bg-gray-50 opacity-60' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono text-gray-900">{term.term_code}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-gray-900">{term.term_name}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">
                    {CALCULATION_TYPE_LABELS[term.calculation_type]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{term.days}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <PaymentTermStatusBadge isActive={term.is_active} isDeleted={isDeleted} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-3">
                    {!isDeleted && (
                      <>
                        <button 
                          onClick={() => onEdit(term.id)} 
                          className="text-blue-600 hover:text-blue-900 transition-colors flex items-center gap-1"
                          aria-label={`Edit ${term.term_name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button 
                          onClick={() => onDelete(term.id, term.term_name)} 
                          className="text-red-600 hover:text-red-900 transition-colors flex items-center gap-1"
                          aria-label={`Delete ${term.term_name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </>
                    )}
                    {isDeleted && (
                      <button 
                        onClick={() => onRestore(term.id, term.term_name)} 
                        className="text-green-600 hover:text-green-900 transition-colors flex items-center gap-1"
                        aria-label={`Restore ${term.term_name}`}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restore
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
  )
}
