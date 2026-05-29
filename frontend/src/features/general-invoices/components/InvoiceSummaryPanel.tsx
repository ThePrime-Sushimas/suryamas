import { Info } from 'lucide-react'
import { formatRupiah, formatDate } from '../constants'

interface LineInput {
  amount: string
  tax_amount: string
  description: string
  transaction_type: 'EXPENSE' | 'PREPAID'
  total_periods: string
  amortization_start_date: string
}

interface Props {
  vendorName: string
  invoiceDate: string
  dueDate: string
  periodStart: string
  periodEnd: string
  lines: LineInput[]
  totalAmount: number
}

/**
 * Panel ringkasan yang muncul setelah user mengisi form invoice.
 * Memberikan gambaran naratif tentang apa yang akan terjadi saat invoice disimpan/diposting.
 */
export function InvoiceSummaryPanel({
  vendorName,
  invoiceDate,
  dueDate,
  periodStart,
  periodEnd,
  lines,
  totalAmount,
}: Props) {
  // Don't show if minimal data isn't filled
  const hasVendor = !!vendorName
  const hasDate = !!invoiceDate
  const hasLines = lines.some((l) => parseFloat(l.amount) > 0)

  if (!hasVendor || !hasDate || !hasLines) return null

  const expenseLines = lines.filter((l) => l.transaction_type === 'EXPENSE' && parseFloat(l.amount) > 0)
  const prepaidLines = lines.filter((l) => l.transaction_type === 'PREPAID' && parseFloat(l.amount) > 0)

  const expenseTotal = expenseLines.reduce((s, l) => s + (parseFloat(l.amount) || 0) + (parseFloat(l.tax_amount) || 0), 0)
  const prepaidTotal = prepaidLines.reduce((s, l) => s + (parseFloat(l.amount) || 0) + (parseFloat(l.tax_amount) || 0), 0)

  // Build period description
  const periodDesc = periodStart && periodEnd
    ? `untuk periode ${formatDate(periodStart)} – ${formatDate(periodEnd)}`
    : periodStart
      ? `mulai ${formatDate(periodStart)}`
      : ''

  // Build amortization summaries
  const amortSummaries = prepaidLines
    .filter((l) => l.total_periods && l.amortization_start_date)
    .map((l) => {
      const amount = parseFloat(l.amount) || 0
      const periods = parseInt(l.total_periods) || 1
      const perMonth = amount / periods
      const start = new Date(l.amortization_start_date)
      const end = new Date(start)
      end.setMonth(end.getMonth() + periods - 1)
      const endStr = end.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
      const startStr = start.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
      return {
        description: l.description || 'Prepaid',
        amount,
        periods,
        perMonth,
        startStr,
        endStr,
      }
    })

  // Days until due
  const daysUntilDue = dueDate
    ? Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
      <div className="flex items-start gap-2">
        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1.5 text-sm text-blue-900">
          <p className="font-semibold text-xs text-blue-700 uppercase tracking-wide">Ringkasan Invoice</p>

          {/* Main narrative */}
          <p>
            Tagihan dari <strong>{vendorName}</strong> sebesar{' '}
            <strong>{formatRupiah(totalAmount)}</strong>
            {periodDesc ? ` ${periodDesc}` : ''}.
            {' '}Tanggal invoice: {formatDate(invoiceDate)}.
          </p>

          {/* Due date info */}
          {dueDate && (
            <p className="text-blue-800">
              ⏰ Jatuh tempo: {formatDate(dueDate)}
              {daysUntilDue !== null && (
                <span className={`ml-1 ${daysUntilDue < 0 ? 'text-red-600 font-medium' : 'text-blue-600'}`}>
                  ({daysUntilDue < 0 ? `terlambat ${Math.abs(daysUntilDue)} hari` : `${daysUntilDue} hari lagi`})
                </span>
              )}
            </p>
          )}

          {/* Expense lines summary */}
          {expenseLines.length > 0 && (
            <p>
              ⚡ <strong>{formatRupiah(expenseTotal)}</strong> akan langsung dicatat sebagai beban saat posting.
            </p>
          )}

          {/* Prepaid / amortization summary */}
          {prepaidLines.length > 0 && (
            <div className="space-y-1">
              <p>
                ⏱ <strong>{formatRupiah(prepaidTotal)}</strong> dicatat sebagai prepaid (aset), lalu diamortisasi bertahap:
              </p>
              {amortSummaries.map((a, i) => (
                <p key={i} className="ml-4 text-xs text-blue-800">
                  • {a.description}: {formatRupiah(a.perMonth)}/bulan × {a.periods} bulan ({a.startStr} – {a.endStr})
                </p>
              ))}
            </div>
          )}

          {/* What happens on POST */}
          <p className="text-xs text-blue-600 mt-2 pt-2 border-t border-blue-200">
            💡 Saat invoice di-posting, sistem akan membuat jurnal otomatis. Untuk baris prepaid, jadwal amortisasi akan dibuat dan bisa dieksekusi per bulan.
          </p>
        </div>
      </div>
    </div>
  )
}
