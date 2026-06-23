import { useParams } from 'react-router-dom'
import { useListNavigation } from '@/lib/urlFilters'
import { ArrowLeft, FileText, Receipt, Calendar, Building2, User, Clock, ExternalLink } from 'lucide-react'
import { useGeneralInvoice } from '../api/generalApi.api'
import {
  formatRupiah,
  formatDate,
  isOverdue,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  TRANSACTION_TYPE_LABELS,
  VENDOR_TYPE_LABELS,
} from '../constants'
import type { GeneralInvoicePaymentSummary } from '../api/generalApi.api'

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function GeneralInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { backToList } = useListNavigation('/finance/general-invoices')
  const { data: invoice, isLoading } = useGeneralInvoice(id ?? '')

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-40 bg-gray-200 rounded" />
          <div className="h-60 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="p-6 text-center text-gray-500">
        <FileText size={40} className="mx-auto mb-3 opacity-30" />
        <p>Invoice tidak ditemukan</p>
        <button onClick={backToList} className="mt-4 text-blue-600 hover:underline text-sm">
          Kembali ke daftar
        </button>
      </div>
    )
  }

  const overdue = invoice.status === 'POSTED' && isOverdue(invoice.due_date) && !invoice.journal_id
  const payments = invoice.payments ?? (invoice.payment ? [invoice.payment] : [])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={backToList}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Kembali"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">{invoice.invoice_number}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </span>
            {invoice.is_confidential && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
                Konfidensial
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{invoice.vendor_name}</p>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Informasi Invoice</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoItem icon={<Building2 size={14} />} label="Cabang" value={invoice.branch_name} />
          <InfoItem icon={<User size={14} />} label="Vendor" value={invoice.vendor_name} />
          <InfoItem
            label="Tipe Vendor"
            value={invoice.vendor_type ? VENDOR_TYPE_LABELS[invoice.vendor_type] : '-'}
          />
          <InfoItem icon={<Calendar size={14} />} label="Tanggal Invoice" value={formatDate(invoice.invoice_date)} />
          <InfoItem
            label="Jatuh Tempo"
            value={formatDate(invoice.due_date)}
            valueClassName={overdue ? 'text-red-600 font-semibold' : undefined}
          />
          {invoice.period_start && (
            <InfoItem
              label="Periode"
              value={`${formatDate(invoice.period_start)} — ${formatDate(invoice.period_end)}`}
            />
          )}
          <InfoItem label="Subtotal" value={formatRupiah(invoice.subtotal)} />
          <InfoItem label="PPN" value={formatRupiah(invoice.total_tax)} />
          <InfoItem label="Total" value={formatRupiah(invoice.total_amount)} valueClassName="font-bold text-gray-900" />
        </div>
        {invoice.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Catatan</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
        {invoice.attachment_url && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <a
              href={invoice.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink size={14} />
              Lihat Lampiran
            </a>
          </div>
        )}
      </div>

      {/* Invoice Lines */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Detail Baris ({invoice.lines.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-10">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Akun</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Keterangan</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Tipe</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Jumlah</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">PPN</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{line.line_number}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900 text-xs">{line.account_code}</div>
                    <div className="text-gray-500 text-xs">{line.account_name}</div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 text-xs">{line.description || '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      line.transaction_type === 'PREPAID'
                        ? 'bg-violet-50 text-violet-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {TRANSACTION_TYPE_LABELS[line.transaction_type]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-900 text-xs">{formatRupiah(line.amount)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{formatRupiah(line.tax_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 text-xs">{formatRupiah(line.total_amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-gray-700 text-right">Total</td>
                <td className="px-4 py-2.5 text-right text-xs font-semibold">{formatRupiah(invoice.subtotal)}</td>
                <td className="px-4 py-2.5 text-right text-xs font-semibold">{formatRupiah(invoice.total_tax)}</td>
                <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{formatRupiah(invoice.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Prepaid / Amortization info for PREPAID lines */}
      {invoice.lines.some(l => l.transaction_type === 'PREPAID') && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Info Amortisasi (Prepaid)</h2>
          <div className="space-y-2">
            {invoice.lines
              .filter(l => l.transaction_type === 'PREPAID')
              .map(line => (
                <div key={line.id} className="flex items-center gap-4 text-xs bg-violet-50 rounded-lg px-4 py-2.5">
                  <span className="font-medium text-violet-800">{line.account_code}</span>
                  <span className="text-violet-600">
                    Akun Beban: {line.expense_account_code ?? '-'} ({line.expense_account_name ?? '-'})
                  </span>
                  <span className="text-violet-600">{line.total_periods} periode</span>
                  <span className="text-violet-600">Mulai: {formatDate(line.amortization_start_date)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Journal Entry */}
      {invoice.journal_id && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Jurnal</h2>
          <div className="flex items-center gap-2 text-sm">
            <FileText size={14} className="text-blue-500" />
            <span className="font-mono text-gray-700">{invoice.journal_number ?? '-'}</span>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Riwayat Pembayaran</h2>
        </div>
        {payments.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            <Receipt size={28} className="mx-auto mb-2 opacity-30" />
            <p>Belum ada pembayaran</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {payments.map((pay) => (
              <PaymentRow key={pay.id} payment={pay} />
            ))}
          </div>
        )}
      </div>

      {/* Audit Trail */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Audit Trail</h2>
        <div className="space-y-3">
          <AuditItem
            icon={<Clock size={14} />}
            label="Dibuat"
            user={invoice.created_by_name}
            date={invoice.created_at}
          />
          {invoice.posted_at && (
            <AuditItem
              icon={<FileText size={14} />}
              label="Diposting"
              user={invoice.posted_by_name}
              date={invoice.posted_at}
            />
          )}
          <AuditItem
            icon={<Clock size={14} />}
            label="Terakhir diubah"
            date={invoice.updated_at}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────

function InfoItem({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon?: React.ReactNode
  label: string
  value: string | undefined | null
  valueClassName?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">
        {icon}
        {label}
      </div>
      <p className={`text-sm ${valueClassName ?? 'text-gray-900'}`}>{value || '-'}</p>
    </div>
  )
}

function PaymentRow({ payment }: { payment: GeneralInvoicePaymentSummary }) {
  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-900">{payment.payment_number}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[payment.status]}`}>
            {PAYMENT_STATUS_LABELS[payment.status]}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {payment.payment_date ? formatDate(payment.payment_date) : 'Belum dijadwalkan'}
          {payment.paid_at && ` — Dibayar ${fmtDateTime(payment.paid_at)}`}
        </div>
      </div>
      <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">
        {formatRupiah(payment.total_amount)}
      </div>
    </div>
  )
}

function AuditItem({
  icon,
  label,
  user,
  date,
}: {
  icon: React.ReactNode
  label: string
  user?: string | null
  date?: string | null
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">
          {user && <span className="text-gray-700">{user}</span>}
          {user && date && ' — '}
          {date && fmtDateTime(date)}
        </p>
      </div>
    </div>
  )
}
