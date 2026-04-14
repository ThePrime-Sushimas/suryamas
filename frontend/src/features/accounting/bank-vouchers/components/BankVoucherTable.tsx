import React from 'react'
import { useBankVouchersStore } from '../store/bankVouchers.store'
import { bankVouchersApi } from '../api/bankVouchers.api'
import type { VoucherDay, VoucherLine, DailySummaryItem, VoucherStatus } from '../types/bank-vouchers.types'

const formatIDR = (amount: number): string => {
  if (amount === 0) return '-'
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(amount))
}

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const StatusBadge = ({ status }: { status?: VoucherStatus }) => {
  const styles: Record<string, string> = {
    DRAFT: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    CONFIRMED: 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    JOURNALED: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    VOID: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  }
  const s = status || 'DRAFT'
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-tight ${styles[s] || styles.DRAFT}`}>
      {s}
    </span>
  )
}

export const BankVoucherTable = () => {
  const {
    preview, summaryData, loading,
    expandedDates, toggleDate, expandAll, collapseAll,
    setActiveTab,
  } = useBankVouchersStore()

  if (loading.preview) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded w-full" />)}
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
        Pilih periode dan klik <strong>Tampilkan</strong> untuk melihat buku mutasi bank
      </div>
    )
  }

  if (preview.vouchers.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
        Tidak ada transaksi yang sudah direkonsiliasi untuk periode {preview.period_label}
      </div>
    )
  }


  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pt-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {preview.vouchers.length} voucher · {preview.summary.total_lines} baris
        </p>
        <div className="flex items-center gap-3">
          <button onClick={expandAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Buka Semua</button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button onClick={collapseAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Tutup Semua</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800">
            <tr className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              <th className="px-3 py-3 text-left w-24">Tanggal</th>
              <th className="px-3 py-3 text-left w-32">Voucher</th>
              <th className="px-3 py-3 text-left w-20">Status</th>
              <th className="px-3 py-3 text-left">Keterangan</th>
              <th className="px-3 py-3 text-left">Bank</th>
              <th className="px-3 py-3 text-right">Debit (Masuk)</th>
              <th className="px-3 py-3 text-right">Kredit (Keluar)</th>
              <th className="px-3 py-3 text-right w-40">Saldo</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {preview.vouchers.map((voucher: VoucherDay) => {
              const isExpanded = expandedDates.has(voucher.transaction_date)
              const dailySummary = summaryData?.by_date.find(
                (d: DailySummaryItem) => d.transaction_date === voucher.transaction_date
              )
              const runningBalance = dailySummary?.running_balance ?? 0
              const isConfirmed = voucher.is_confirmed

              return (
                <React.Fragment key={`${voucher.transaction_date}_${voucher.bank_account_id}`}>
                  {/* Day header row */}
                  <tr
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-all border-l-4 ${
                      isConfirmed ? 'border-l-green-400 bg-green-50/30 dark:bg-green-900/5' : 'border-l-transparent hover:border-l-blue-500 bg-white dark:bg-gray-800'
                    }`}
                    onClick={() => toggleDate(voucher.transaction_date)}
                  >
                    <td className="px-3 py-4">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatDate(voucher.transaction_date)}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-tight bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800">
                        {voucher.voucher_number}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={voucher.status} />
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                          Mutasi Penjualan Harian
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {voucher.branch_name} · {voucher.lines.filter((l: VoucherLine) => !l.is_fee_line).length} payment method
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{voucher.bank_account_name}</span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <span className="text-sm font-bold font-mono text-green-600 dark:text-green-400">
                        {formatIDR(voucher.day_total)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right text-gray-300 dark:text-gray-600 font-mono text-sm">—</td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                          {formatIDR(runningBalance)}
                        </span>
                        <span className={`p-1 bg-gray-100 dark:bg-gray-700 rounded transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Detail Lines */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="px-6 py-0 bg-gray-50/50 dark:bg-gray-900/20">
                        <div className="py-4 space-y-3">
                          <div className="flex items-center justify-between px-2">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              Detail Alokasi — {voucher.voucher_number}
                            </h4>
                            <div className="flex items-center gap-3">
                              {voucher.status === 'DRAFT' && (
                                <button
                                  onClick={e => { e.stopPropagation(); setActiveTab('list') }}
                                  className="text-[10px] text-amber-600 hover:underline flex items-center gap-1"
                                >
                                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                  DRAFT — Konfirmasi di Daftar Voucher →
                                </button>
                              )}
                              {isConfirmed && (
                                <a
                                  href={bankVouchersApi.getPrintUrl(voucher.voucher_number)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                  </svg>
                                  Print
                                </a>
                              )}
                            </div>
                          </div>

                          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                            <thead className="text-[9px] text-gray-400 uppercase">
                              <tr>
                                <th className="px-2 py-1 text-left w-36">Akun Bank</th>
                                <th className="px-2 py-1 text-left">Keterangan</th>
                                <th className="px-2 py-1 text-right">Gross</th>
                                <th className="px-2 py-1 text-right">PPN</th>
                                <th className="px-2 py-1 text-right">Fee Aktual</th>
                                <th className="px-2 py-1 text-right">Nett Aktual</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs">
                              {voucher.lines.map((line: VoucherLine, i: number) => (
                                <tr
                                  key={i}
                                  className={`transition-colors ${
                                    line.is_fee_line
                                      ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                                      : 'hover:bg-white dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <td className="px-2 py-2">
                                    <p className="font-medium text-gray-700 dark:text-gray-300">{line.bank_account_name}</p>
                                    <p className="text-[10px] text-gray-400">{line.bank_account_number}</p>
                                  </td>
                                  <td className="px-2 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${line.is_fee_line ? 'bg-red-400' : 'bg-green-400'}`} />
                                      <span className={line.is_fee_line ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
                                        {line.description}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono text-gray-500">
                                    {line.is_fee_line ? '—' : formatIDR(line.gross_amount)}
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono text-orange-400">
                                    {line.is_fee_line ? '—' : (line.tax_amount > 0 ? formatIDR(line.tax_amount) : '—')}
                                  </td>
                                  <td className="px-2 py-2 text-right font-mono text-red-400">
                                    {line.is_fee_line ? formatIDR(Math.abs(line.nett_amount)) : '—'}
                                  </td>
                                  <td className={`px-2 py-2 text-right font-mono font-bold ${
                                    line.nett_amount < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'
                                  }`}>
                                    {line.nett_amount < 0 ? `(${formatIDR(Math.abs(line.nett_amount))})` : formatIDR(line.nett_amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                              <tr>
                                <td colSpan={2} className="px-2 py-1.5 text-right uppercase tracking-wide">Subtotal</td>
                                <td className="px-2 py-1.5 text-right font-mono text-gray-600 dark:text-gray-300">
                                  {formatIDR(voucher.lines.filter(l => !l.is_fee_line).reduce((s, l) => s + l.gross_amount, 0))}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono text-orange-400">
                                  {formatIDR(voucher.lines.filter(l => !l.is_fee_line).reduce((s, l) => s + l.tax_amount, 0))}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono text-red-400">
                                  {formatIDR(voucher.lines.filter(l => l.is_fee_line).reduce((s, l) => s + l.actual_fee_amount, 0))}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono text-blue-600 dark:text-blue-400">
                                  {formatIDR(voucher.day_total)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>

          <tfoot className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
            <tr className="font-bold text-gray-900 dark:text-gray-100">
              <td colSpan={5} className="px-3 py-4 text-right uppercase text-xs tracking-wider text-gray-400">
                Total Periode
              </td>
              <td className="px-3 py-4 text-right font-mono text-green-600 dark:text-green-400 border-l border-gray-100 dark:border-gray-800">
                {formatIDR(preview.summary.total_nett + preview.summary.total_fee)}
              </td>
              <td className="px-3 py-4 text-right font-mono text-red-600 dark:text-red-400">
                ({formatIDR(preview.summary.total_fee)})
              </td>
              <td className="px-3 py-4 text-right font-mono text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20">
                {formatIDR(preview.summary.total_nett)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
