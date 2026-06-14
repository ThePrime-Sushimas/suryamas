import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Send } from 'lucide-react'
import { apPaymentBatchPath } from '../constants'
import type { ApPayment } from '../api/apPayments.api'
import { AP_STATUS_CONFIG, AP_JOURNAL_STATUS_LABELS } from '../constants'
import { BulkBadge } from './BulkBadge'
import { batchGroupTotals } from '../utils/groupPaymentsByBatch'
import { getApPaymentTableColumnCount } from '../utils/apPaymentTableColumns'
import { apTheme } from '../ap-payments.theme'

type PaymentRowProps = {
  payment: ApPayment
  isPaidTab: boolean
  canUpdate: boolean
  canDelete: boolean
  nested?: boolean
  onOpen: (id: string) => void
  onDelete: (payment: ApPayment) => void
  onPostJournal: (payment: ApPayment) => void
  postJournalPending: boolean
  fmtCurrency: (v: number) => string
  fmtDate: (d: string | null) => string
}

function PaymentRow({
  payment: p,
  isPaidTab,
  canUpdate,
  canDelete,
  nested,
  onOpen,
  onDelete,
  onPostJournal,
  postJournalPending,
  fmtCurrency,
  fmtDate,
}: PaymentRowProps) {
  const st = AP_STATUS_CONFIG[p.status]

  return (
    <tr
      onClick={() => onOpen(p.id)}
      className={`${apTheme.hoverRow} cursor-pointer ${nested ? 'bg-violet-50/40 dark:bg-violet-950/20' : ''}`}
    >
      <td className="px-2 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{p.supplier_name}</td>
      <td className="px-2 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(p.paid_at)}</td>
      <td className="px-2 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">
        {fmtCurrency(Number(p.total_amount))}
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${st.color}`}>{st.label}</span>
      </td>
      <td className={`px-2 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap ${nested ? 'pl-6' : ''}`}>
        <div className="flex flex-col gap-0.5">
          <span>{p.payment_number}</span>
          {(p.invoice_count ?? 0) > 1 && (
            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
              {p.invoice_count} invoice
            </span>
          )}
        </div>
      </td>
      {isPaidTab && canUpdate && (
        <td className="px-2 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {p.journal_id ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">
                {p.journal_number ?? '—'}
                {p.journal_status && (
                  <span className="ml-1 uppercase tracking-wide">
                    ({AP_JOURNAL_STATUS_LABELS[p.journal_status] ?? p.journal_status})
                  </span>
                )}
              </span>
              {p.journal_status !== 'POSTED' && (
                <button
                  type="button"
                  disabled={postJournalPending}
                  onClick={() => onPostJournal(p)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  <Send className="w-3 h-3" /> Post
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
      )}
      {canDelete && (
        <td className="px-2 py-2">
          {p.status === 'DRAFT' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(p)
              }}
              className="text-[10px] text-red-600 hover:underline"
            >
              Hapus
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

export interface BulkPaymentBatchRowsProps {
  batchId: string
  payments: ApPayment[]
  expanded: boolean
  onToggle: () => void
  isPaidTab: boolean
  canUpdate: boolean
  canDelete: boolean
  onOpen: (id: string) => void
  onDelete: (payment: ApPayment) => void
  onPostJournal: (payment: ApPayment) => void
  postJournalPending: boolean
  fmtCurrency: (v: number) => string
  fmtDate: (d: string | null) => string
}

export function BulkPaymentBatchRows({
  batchId,
  payments,
  expanded,
  onToggle,
  ...rowProps
}: BulkPaymentBatchRowsProps) {
  const { totalAmount, invoiceCount, paymentCount, supplierNames } = batchGroupTotals(payments)
  const supplierLabel =
    supplierNames.length <= 2
      ? supplierNames.join(', ')
      : `${supplierNames.slice(0, 2).join(', ')} +${supplierNames.length - 2}`
  const colSpan = getApPaymentTableColumnCount({
    showJournal: rowProps.isPaidTab && rowProps.canUpdate,
    showDelete: rowProps.canDelete,
  })

  return (
    <>
      <tr
        className="bg-violet-50/70 dark:bg-violet-950/30 border-t border-violet-100 dark:border-violet-900/40"
        onClick={onToggle}
      >
        <td colSpan={colSpan} className="px-2 py-2.5">
          <div className="flex items-center gap-2 cursor-pointer">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-violet-600 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-violet-600 shrink-0" />
            )}
            <span className="text-xs font-semibold text-gray-900 dark:text-white truncate max-w-[250px]">
              {supplierLabel}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {paymentCount} pembayaran · {invoiceCount} invoice
            </span>
            <BulkBadge batchId={batchId} />
            <span className="text-xs font-semibold text-gray-900 dark:text-white ml-auto whitespace-nowrap">
              {rowProps.fmtCurrency(totalAmount)}
            </span>
            <Link
              to={apPaymentBatchPath(batchId)}
              onClick={(e) => e.stopPropagation()}
              className="ml-2 shrink-0 px-2.5 py-1 rounded-xl text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              Kelola batch
            </Link>
          </div>
        </td>
      </tr>
      {expanded &&
        payments.map((p) => (
          <PaymentRow key={p.id} payment={p} nested {...rowProps} />
        ))}
    </>
  )
}

export { PaymentRow }
