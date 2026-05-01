import { Edit2, Trash2 } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PaymentMethodStatusBadge } from './PaymentMethodStatusBadge'
import type { PaymentMethod } from '../types'

interface PaymentMethodTableProps {
  paymentMethods: PaymentMethod[]
  onEdit: (id: number) => void
  onDelete: (id: number, name: string) => void
  loading?: boolean
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  BANK: 'Bank',
  CARD: 'Kartu',
  CASH: 'Tunai',
  COMPLIMENT: 'Compliment',
  MEMBER_DEPOSIT: 'Deposit Member',
  OTHER_COST: 'Biaya Lain',
}

export const PaymentMethodTable = ({
  paymentMethods,
  onEdit,
  onDelete,
  loading,
}: PaymentMethodTableProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <TableSkeleton rows={5} columns={5} />
      </div>
    )
  }

  if (paymentMethods.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Belum ada metode pembayaran</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Buat metode pembayaran baru untuk memulai</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kode</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bank</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Konfigurasi Fee</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">COA Fee</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">COA Hutang Fee</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">COA</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {paymentMethods.map(method => (
            <tr key={method.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{method.code}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{method.name}</div>
                {method.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{method.description}</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {PAYMENT_TYPE_LABELS[method.payment_type] || method.payment_type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {method.bank_name ? (
                  <div className="text-sm">
                    <span className="text-gray-900 dark:text-gray-100">{method.bank_name}</span>
                    {method.account_number && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">({method.account_number})</span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {method.fee_percentage > 0 || method.fee_fixed_amount > 0 ? (
                  <div className="text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                      {method.fee_percentage > 0 && `${method.fee_percentage}%`}
                      {method.fee_percentage > 0 && method.fee_fixed_amount > 0 && ' + '}
                      {method.fee_fixed_amount > 0 && (
                        <>
                          Rp {method.fee_fixed_amount.toLocaleString()}
                          {method.fee_fixed_per_transaction && '/tx'}
                        </>
                      )}
                    </span>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {method.fee_fixed_per_transaction ? 'per tx' : 'per total'}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">Gratis</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {method.fee_coa_code && method.fee_coa_name ? (
                  <div className="text-sm">
                    <span className="text-gray-900 dark:text-gray-100 font-mono">{method.fee_coa_code}</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{method.fee_coa_name}</div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {method.fee_liability_coa_code && method.fee_liability_coa_name ? (
                  <div className="text-sm">
                    <span className="text-gray-900 dark:text-gray-100 font-mono">{method.fee_liability_coa_code}</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{method.fee_liability_coa_name}</div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {method.coa_code && method.coa_name ? (
                  <div className="text-sm">
                    <span className="text-gray-900 dark:text-gray-100 font-mono">{method.coa_code}</span>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{method.coa_name}</div>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <PaymentMethodStatusBadge isActive={method.is_active} isDefault={method.is_default} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(method.id)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(method.id, method.name)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
