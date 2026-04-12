import { useBankVouchersStore } from '../store/bankVouchers.store'
import type { VoucherDay, VoucherLine } from '../types/bank-vouchers.types'

// ============================================
// Format currency IDR
// ============================================
const formatIDR = (amount: number): string => {
  if (amount === 0) return '-'
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))
}

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ============================================
// Single voucher line row
// ============================================
const VoucherLineRow = ({
  line,
  isFirst,
  voucherNumber,
  transactionDate,
  totalLines,
}: {
  line: VoucherLine
  isFirst: boolean
  voucherNumber: string
  transactionDate: string
  totalLines: number
}) => (
  <tr className={`
    text-xs
    ${line.is_fee_line
      ? 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400'
      : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200'}
    hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
  `}>
    {/* Tanggal — hanya di baris pertama per hari (rowspan simulasi) */}
    {isFirst && (
      <td
        className="px-3 py-2 whitespace-nowrap font-mono text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-gray-800 align-top"
        rowSpan={totalLines}
      >
        {formatDate(transactionDate)}
      </td>
    )}

    {/* No. Voucher — hanya di baris pertama */}
    {isFirst && (
      <td
        className="px-3 py-2 whitespace-nowrap font-mono font-semibold text-blue-600 dark:text-blue-400 border-r border-gray-100 dark:border-gray-800 align-top"
        rowSpan={totalLines}
      >
        {voucherNumber}
      </td>
    )}

    {/* No. Line */}
    <td className="px-3 py-2 text-center text-gray-400 dark:text-gray-600 border-r border-gray-100 dark:border-gray-800">
      {line.line_number}
    </td>

    {/* Keterangan */}
    <td className="px-3 py-2 border-r border-gray-100 dark:border-gray-800">
      <span className="font-medium">{line.description}</span>
      {line.is_fee_line && (
        <span className="ml-2 text-xs text-red-500 dark:text-red-400">(pengurang)</span>
      )}
    </td>

    {/* Bank */}
    <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 dark:border-gray-800">
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
        {line.bank_account_name}
      </span>
    </td>

    {/* Gross */}
    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100 dark:border-gray-800 font-mono">
      {line.is_fee_line ? '-' : formatIDR(line.gross_amount)}
    </td>

    {/* PPN */}
    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100 dark:border-gray-800 font-mono">
      {line.is_fee_line ? '-' : (line.tax_amount > 0 ? formatIDR(line.tax_amount) : '-')}
    </td>

    {/* Fee */}
    <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-100 dark:border-gray-800 font-mono">
      {line.actual_fee_amount > 0 ? (
        <span className="text-red-600 dark:text-red-400">
          ({formatIDR(line.actual_fee_amount)})
        </span>
      ) : '-'}
    </td>

    {/* Nett / Total */}
    <td className={`px-3 py-2 text-right whitespace-nowrap font-mono font-semibold ${
      line.nett_amount < 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-green-700 dark:text-green-400'
    }`}>
      {line.nett_amount < 0
        ? `(${formatIDR(line.nett_amount)})`
        : formatIDR(line.nett_amount)
      }
    </td>
  </tr>
)

// ============================================
// Daily subtotal row
// ============================================
const DayTotalRow = ({ voucher }: { voucher: VoucherDay }) => (
  <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 text-xs font-bold">
    <td colSpan={8} className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 uppercase tracking-wider">
      Total {formatDate(voucher.transaction_date)} ({voucher.voucher_number})
    </td>
    <td className={`px-3 py-2 text-right font-mono ${
      voucher.day_total >= 0
        ? 'text-green-700 dark:text-green-400'
        : 'text-red-600 dark:text-red-400'
    }`}>
      {voucher.day_total >= 0
        ? formatIDR(voucher.day_total)
        : `(${formatIDR(voucher.day_total)})`
      }
    </td>
  </tr>
)

// ============================================
// Main table component
// ============================================
export const BankVoucherTable = () => {
  const { preview, loading, expandedDates, toggleDate, expandAll, collapseAll } = useBankVouchersStore()

  if (loading.preview) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded w-full" />
        ))}
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="text-sm">Pilih periode dan klik <strong>Tampilkan</strong> untuk melihat buku mutasi bank</p>
      </div>
    )
  }

  if (preview.vouchers.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="text-sm">Tidak ada transaksi yang sudah direkonsiliasi untuk periode {preview.period_label}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Expand/Collapse controls */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {preview.vouchers.length} voucher · {preview.summary.total_lines} baris
        </p>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Buka Semua
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
            <tr className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="px-3 py-3 text-left border-b border-r border-gray-200 dark:border-gray-700 w-20">Tgl</th>
              <th className="px-3 py-3 text-left border-b border-r border-gray-200 dark:border-gray-700 w-28">No. BM</th>
              <th className="px-3 py-3 text-center border-b border-r border-gray-200 dark:border-gray-700 w-10">#</th>
              <th className="px-3 py-3 text-left border-b border-r border-gray-200 dark:border-gray-700">Keterangan</th>
              <th className="px-3 py-3 text-left border-b border-r border-gray-200 dark:border-gray-700 w-28">Bank</th>
              <th className="px-3 py-3 text-right border-b border-r border-gray-200 dark:border-gray-700 w-28">Gross</th>
              <th className="px-3 py-3 text-right border-b border-r border-gray-200 dark:border-gray-700 w-24">PPN</th>
              <th className="px-3 py-3 text-right border-b border-r border-gray-200 dark:border-gray-700 w-24">Fee</th>
              <th className="px-3 py-3 text-right border-b border-gray-200 dark:border-gray-700 w-28">Nett</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {preview.vouchers.map((voucher) => {
              const isExpanded = expandedDates.has(voucher.transaction_date)

              return (
                <>
                  {/* Day header row — clickable untuk expand/collapse */}
                  <tr
                    key={`header-${voucher.transaction_date}`}
                    className="bg-blue-50 dark:bg-blue-900/20 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    onClick={() => toggleDate(voucher.transaction_date)}
                  >
                    <td colSpan={9} className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                            {formatDate(voucher.transaction_date)}
                          </span>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {voucher.voucher_number}
                          </span>
                          <span className="text-xs text-blue-500 dark:text-blue-400">
                            {voucher.branch_name}
                          </span>
                          <span className="text-xs text-blue-400 dark:text-blue-500">
                            {voucher.lines.length} baris
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-mono font-bold ${
                            voucher.day_total >= 0
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {voucher.day_total >= 0
                              ? formatIDR(voucher.day_total)
                              : `(${formatIDR(voucher.day_total)})`
                            }
                          </span>
                          <svg
                            className={`w-4 h-4 text-blue-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Lines — only when expanded */}
                  {isExpanded && voucher.lines.map((line, idx) => (
                    <VoucherLineRow
                      key={`${voucher.transaction_date}-${line.line_number}`}
                      line={line}
                      isFirst={idx === 0}
                      voucherNumber={voucher.voucher_number}
                      transactionDate={voucher.transaction_date}
                      totalLines={voucher.lines.length}
                    />
                  ))}

                  {/* Day total */}
                  {isExpanded && (
                    <DayTotalRow
                      key={`total-${voucher.transaction_date}`}
                      voucher={voucher}
                    />
                  )}
                </>
              )
            })}
          </tbody>

          {/* Grand total footer */}
          <tfoot className="bg-gray-200 dark:bg-gray-700 border-t-2 border-gray-400 dark:border-gray-500">
            <tr className="text-xs font-bold">
              <td colSpan={5} className="px-3 py-3 text-right text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Total Periode {preview.period_label}
              </td>
              <td className="px-3 py-3 text-right font-mono text-gray-800 dark:text-gray-200">
                {formatIDR(preview.summary.total_gross)}
              </td>
              <td className="px-3 py-3 text-right font-mono text-gray-800 dark:text-gray-200">
                {preview.summary.total_tax > 0 ? formatIDR(preview.summary.total_tax) : '-'}
              </td>
              <td className="px-3 py-3 text-right font-mono text-red-600 dark:text-red-400">
                {preview.summary.total_fee > 0 ? `(${formatIDR(preview.summary.total_fee)})` : '-'}
              </td>
              <td className="px-3 py-3 text-right font-mono text-green-700 dark:text-green-400">
                {formatIDR(preview.summary.total_nett)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
