import { useState, useMemo, useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import {
  useCombinedInvoicePayments,
  type CombinedInvoicePaymentQuery,
  type CombinedInvoicePaymentRow,
} from '../api/apPayments.api'
import { AP_PAYMENT_METHOD_LABELS, AP_STATUS_CONFIG } from '../constants'
import { AgingBadge } from './AgingBadge'
import { apTheme } from '../ap-payments.theme'

const DEFAULT_PAGE_SIZE = 25

const fmtCurrency = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(v)
    : '—'

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

interface CombinedInvoicePaymentsTabProps {
  filters: {
    supplierId: string
    branchId: string
    search: string
    dateFrom: string
    dateTo: string
    dueDateFrom: string
    dueDateTo: string
    receivedDateFrom: string
    receivedDateTo: string
    status: string
  }
}

export function CombinedInvoicePaymentsTab({ filters }: CombinedInvoicePaymentsTabProps) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  const query: CombinedInvoicePaymentQuery = useMemo(
    () => ({
      page,
      limit,
      ...(filters.supplierId ? { supplier_id: filters.supplierId } : {}),
      ...(filters.branchId ? { branch_id: filters.branchId } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
      ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
      ...(filters.dueDateFrom ? { due_date_from: filters.dueDateFrom } : {}),
      ...(filters.dueDateTo ? { due_date_to: filters.dueDateTo } : {}),
      ...(filters.receivedDateFrom ? { received_date_from: filters.receivedDateFrom } : {}),
      ...(filters.receivedDateTo ? { received_date_to: filters.receivedDateTo } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    }),
    [page, limit, filters],
  )

  const { data, isLoading, isError } = useCombinedInvoicePayments(query)

  const rows = data?.data ?? []
  const pagination = data?.pagination

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit)
    setPage(1)
  }, [])

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Gagal memuat data gabungan
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={apTheme.skeleton} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className={`text-center py-16 ${apTheme.card} p-8`}>
            <p className={apTheme.muted}>Tidak ada data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rose-200/80 dark:border-gray-700">
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">No. Invoice</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Supplier</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Cabang</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Total Invoice</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Sisa</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Tgl Terima</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Jatuh Tempo</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status Invoice</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">No. Pembayaran</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Status Bayar</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Metode</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Tgl Bayar</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Nominal Bayar</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Rek. Sumber</th>
                  <th className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Rek. Tujuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-100 dark:divide-gray-700 whitespace-nowrap">
                {rows.map((row, idx) => (
                  <CombinedRow key={`${row.invoice_id}-${row.payment_id ?? idx}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className={`border-t ${apTheme.divideBorder} bg-white/85 dark:bg-gray-800 backdrop-blur-md px-4 py-3`}>
          <Pagination
            pagination={{
              ...pagination,
              hasNext: page < pagination.totalPages,
              hasPrev: page > 1,
            }}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            currentLength={rows.length}
            loading={isLoading}
          />
        </div>
      )}
    </div>
  )
}

function CombinedRow({ row }: { row: CombinedInvoicePaymentRow }) {
  const invoiceStatusLabel =
    row.invoice_status === 'APPROVED' ? 'Approved' : 'Posted'
  const invoiceStatusColor =
    row.invoice_status === 'APPROVED'
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'

  const paymentStatusLabel = row.payment_status
    ? AP_STATUS_CONFIG[row.payment_status as keyof typeof AP_STATUS_CONFIG]?.label ?? row.payment_status
    : '—'
  const paymentStatusColor = row.payment_status
    ? AP_STATUS_CONFIG[row.payment_status as keyof typeof AP_STATUS_CONFIG]?.color ?? ''
    : ''

  const methodLabel = row.payment_method
    ? AP_PAYMENT_METHOD_LABELS[row.payment_method as keyof typeof AP_PAYMENT_METHOD_LABELS] ?? row.payment_method
    : '—'

  return (
    <tr className={apTheme.hoverRow}>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
        {row.invoice_number}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.supplier_name}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.branch_name}</td>
      <td className="px-3 py-3 text-gray-900 dark:text-white">{fmtCurrency(row.invoice_total_amount)}</td>
      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{fmtCurrency(row.invoice_remaining_amount)}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{fmtDate(row.earliest_received_date)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-700 dark:text-gray-300">{fmtDate(row.invoice_due_date)}</span>
          <AgingBadge dueDate={row.invoice_due_date} />
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${invoiceStatusColor}`}>
          {invoiceStatusLabel}
        </span>
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.payment_number ?? '—'}</td>
      <td className="px-3 py-3">
        {row.payment_status ? (
          <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${paymentStatusColor}`}>
            {paymentStatusLabel}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{methodLabel}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{fmtDate(row.paid_at ?? row.payment_date)}</td>
      <td className="px-3 py-3 text-gray-900 dark:text-white">{fmtCurrency(row.payment_amount)}</td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
        {row.source_bank_name ? (
          <span className="text-xs">
            {row.source_bank_name} · {row.source_account_number}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
        {row.dest_bank_name ? (
          <span className="text-xs">
            {row.dest_bank_name} · {row.dest_account_number}
          </span>
        ) : (
          '—'
        )}
      </td>
    </tr>
  )
}
