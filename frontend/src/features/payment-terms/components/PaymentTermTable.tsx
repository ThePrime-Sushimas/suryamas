import { Edit2, Trash2, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PaymentTerm, CalculationType } from '../types'
import { PaymentTermStatusBadge } from './PaymentTermStatusBadge'
import { TableSkeleton } from '@/components/ui/Skeleton'

interface PaymentTermTableProps {
  paymentTerms: PaymentTerm[]
  onEdit: (id: number) => void
  onDelete: (id: number, termName: string) => void
  onRestore: (id: number, termName: string) => void
  loading?: boolean
}

const CALCULATION_TYPE_LABELS: Record<CalculationType, string> = {
  from_invoice: 'Dari Faktur',
  from_delivery: 'Dari Pengiriman',
  fixed_date: 'Tanggal Tetap',
  fixed_date_immediate: 'Tanggal Tetap (Langsung)',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
}

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const getTermDetails = (term: PaymentTerm): string => {
  switch (term.calculation_type) {
    case 'from_invoice':
    case 'from_delivery':
      return `${term.days} hari`
    case 'fixed_date':
    case 'fixed_date_immediate':
      return term.payment_dates?.map(d => d === 999 ? 'Akhir Bulan' : d).join(', ') || '-'
    case 'weekly':
      return term.payment_day_of_week !== null ? WEEKDAY_LABELS[term.payment_day_of_week] : '-'
    case 'monthly':
      return term.payment_dates?.[0] === 999 ? 'Akhir bulan' : `Tanggal ${term.payment_dates?.[0] || '-'}`
    default:
      return '-'
  }
}

export const PaymentTermTable = ({
  paymentTerms,
  onEdit,
  onDelete,
  onRestore,
  loading,
}: PaymentTermTableProps) => {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <TableSkeleton rows={5} columns={6} />
      </div>
    )
  }

  if (paymentTerms.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">Belum ada syarat pembayaran</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Buat syarat pembayaran baru untuk memulai</p>
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
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe Kalkulasi</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Detail</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {paymentTerms.map(term => {
            const isDeleted = !!term.deleted_at
            return (
              <tr
                key={term.id}
                onClick={() => !isDeleted && navigate(`/payment-terms/${term.id}`)}
                className={`transition-colors ${
                  isDeleted
                    ? 'bg-gray-50 dark:bg-gray-800/50 opacity-60'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{term.term_code}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{term.term_name}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {CALCULATION_TYPE_LABELS[term.calculation_type]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900 dark:text-gray-300">{getTermDetails(term)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <PaymentTermStatusBadge isActive={term.is_active} isDeleted={isDeleted} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    {!isDeleted && (
                      <>
                        <button
                          onClick={() => onEdit(term.id)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(term.id, term.term_name)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {isDeleted && (
                      <button
                        onClick={() => onRestore(term.id, term.term_name)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Pulihkan"
                      >
                        <RotateCcw className="h-4 w-4" />
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
