import React, { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Download, AlertCircle } from 'lucide-react'
import { useTrialBalance } from '../api/trialBalance.api'
import { useTrialBalanceStore } from '../store/trialBalance.store'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import type {
  TrialBalanceRow,
  TrialBalanceSummary,
  TrialBalanceGrouped,
} from '../types/trial-balance.types'

// ============================================================
// HELPERS
// ============================================================

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET:     'Aset',
  LIABILITY: 'Kewajiban',
  EQUITY:    'Ekuitas',
  REVENUE:   'Pendapatan',
  EXPENSE:   'Beban',
}

const ACCOUNT_TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

function formatRp(value: number): string {
  if (value === 0) return '-'
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd-MMM-yyyy', { locale: idLocale })
  } catch {
    return iso
  }
}

function buildSummary(rows: TrialBalanceRow[]): TrialBalanceSummary {
  const sum = (field: keyof TrialBalanceRow) =>
    rows.reduce((acc, r) => acc + (r[field] as number), 0)

  const totalOpeningDebit  = sum('opening_debit')
  const totalOpeningCredit = sum('opening_credit')
  const totalPeriodDebit   = sum('period_debit')
  const totalPeriodCredit  = sum('period_credit')
  const totalClosingDebit  = sum('closing_debit')
  const totalClosingCredit = sum('closing_credit')

  return {
    total_opening_debit:  totalOpeningDebit,
    total_opening_credit: totalOpeningCredit,
    total_period_debit:   totalPeriodDebit,
    total_period_credit:  totalPeriodCredit,
    total_closing_debit:  totalClosingDebit,
    total_closing_credit: totalClosingCredit,
    is_balanced:
      Math.abs(totalClosingDebit - totalClosingCredit) < 0.01,
  }
}

function groupByAccountType(rows: TrialBalanceRow[]): TrialBalanceGrouped[] {
  const map = new Map<string, TrialBalanceRow[]>()
  for (const row of rows) {
    if (!map.has(row.account_type)) map.set(row.account_type, [])
    map.get(row.account_type)!.push(row)
  }

  return ACCOUNT_TYPE_ORDER
    .filter(t => map.has(t))
    .map(t => {
      const groupRows = map.get(t)!
      return {
        account_type:            t,
        rows:                    groupRows,
        subtotal_opening_debit:  groupRows.reduce((s, r) => s + r.opening_debit, 0),
        subtotal_opening_credit: groupRows.reduce((s, r) => s + r.opening_credit, 0),
        subtotal_period_debit:   groupRows.reduce((s, r) => s + r.period_debit, 0),
        subtotal_period_credit:  groupRows.reduce((s, r) => s + r.period_credit, 0),
        subtotal_closing_debit:  groupRows.reduce((s, r) => s + r.closing_debit, 0),
        subtotal_closing_credit: groupRows.reduce((s, r) => s + r.closing_credit, 0),
      }
    })
}

// ============================================================
// EXPORT CSV
// ============================================================

function exportToCsv(
  rows: TrialBalanceRow[],
  dateFrom: string,
  dateTo: string
): void {
  const header = [
    'Kode Akun',
    'Nama Akun',
    'Tipe',
    'Saldo Awal Debit',
    'Saldo Awal Kredit',
    'Mutasi Debit',
    'Mutasi Kredit',
    'Saldo Akhir Debit',
    'Saldo Akhir Kredit',
  ].join(';')

  const dataRows = rows.map((r) =>
    [
      r.account_code,
      `"${r.account_name}"`,
      ACCOUNT_TYPE_LABELS[r.account_type] ?? r.account_type,
      r.opening_debit,
      r.opening_credit,
      r.period_debit,
      r.period_credit,
      r.closing_debit,
      r.closing_credit,
    ].join(';')
  )

  const csv = [header, ...dataRows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `trial-balance_${dateFrom}_${dateTo}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function TrialBalancePage() {
  const currentBranch = useBranchContextStore((state) => state.currentBranch)
  const { filter, setFilter } = useTrialBalanceStore()

  const companyId = currentBranch?.company_id ?? ''

  const activeFilter = useMemo(
    () => ({ ...filter, company_id: companyId }),
    [filter, companyId]
  )

  const { data: rows = [], isLoading, isError, error } = useTrialBalance(activeFilter)

  const groups  = useMemo(() => groupByAccountType(rows), [rows])
  const summary = useMemo(() => buildSummary(rows), [rows])

  const handleExport = () => {
    if (rows.length === 0) return
    exportToCsv(rows, filter.date_from, filter.date_to)
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Neraca Saldo</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Periode {formatDate(filter.date_from)} – {formatDate(filter.date_to)}
          </p>
        </div>
        {rows.length > 0 && (
          <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${
            summary.is_balanced 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
          }`}>
            {summary.is_balanced ? '✓ Balance' : '✗ Tidak Balance'}
          </div>
        )}
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-wrap items-end gap-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="date_from" className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Dari Tanggal
          </label>
          <input
            id="date_from"
            type="date"
            value={filter.date_from}
            onChange={(e) => setFilter({ date_from: e.target.value })}
            className="h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="date_to" className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Sampai Tanggal
          </label>
          <input
            id="date_to"
            type="date"
            value={filter.date_to}
            onChange={(e) => setFilter({ date_to: e.target.value })}
            className="h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex-1" />

        <button
          onClick={handleExport}
          disabled={isLoading || rows.length === 0}
          className="h-10 flex items-center gap-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-medium text-sm"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* ── Summary Cards ── */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saldo Awal Debit</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">{formatRp(summary.total_opening_debit)}</span>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saldo Awal Kredit</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">{formatRp(summary.total_opening_credit)}</span>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm flex flex-col gap-1">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Mutasi Debit Periode</span>
            <span className="text-lg font-bold text-indigo-900 dark:text-indigo-100">{formatRp(summary.total_period_debit)}</span>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm flex flex-col gap-1">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Mutasi Kredit Periode</span>
            <span className="text-lg font-bold text-indigo-900 dark:text-indigo-100">{formatRp(summary.total_period_credit)}</span>
          </div>
          <div className={`p-4 rounded-xl border shadow-sm flex flex-col gap-1 ${
            summary.is_balanced 
              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
          }`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              summary.is_balanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>Saldo Akhir Debit</span>
            <span className={`text-lg font-bold ${
              summary.is_balanced ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
            }`}>{formatRp(summary.total_closing_debit)}</span>
          </div>
          <div className={`p-4 rounded-xl border shadow-sm flex flex-col gap-1 ${
            summary.is_balanced 
              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
          }`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              summary.is_balanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>Saldo Akhir Kredit</span>
            <span className={`text-lg font-bold ${
              summary.is_balanced ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
            }`}>{formatRp(summary.total_closing_credit)}</span>
          </div>
        </div>
      )}

      {/* ── Table Area ── */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded" />
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-1">Gagal Memuat Data</h3>
          <p className="text-sm text-red-600 dark:text-red-300">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Tidak Ada Data</h3>
          <p className="text-gray-500 dark:text-gray-400">
            Pastikan ada jurnal yang berstatus POSTED dalam rentang tanggal yang dipilih.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kode</th>
                <th className="px-4 py-3 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Akun</th>
                <th className="px-4 py-3 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Saldo Awal Debit</th>
                <th className="px-4 py-3 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Saldo Awal Kredit</th>
                <th className="px-4 py-3 font-semibold text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-wider text-right">Mutasi Debit</th>
                <th className="px-4 py-3 font-semibold text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-wider text-right">Mutasi Kredit</th>
                <th className="px-4 py-3 font-semibold text-xs text-emerald-500 dark:text-emerald-400 uppercase tracking-wider text-right">Saldo Akhir Debit</th>
                <th className="px-4 py-3 font-semibold text-xs text-emerald-500 dark:text-emerald-400 uppercase tracking-wider text-right">Saldo Akhir Kredit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50">
              {groups.map((group) => (
                <React.Fragment key={group.account_type}>
                  {/* Group Header */}
                  <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                    <td colSpan={8} className="px-4 py-2 font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 border-y border-blue-100 dark:border-blue-900/50">
                      {ACCOUNT_TYPE_LABELS[group.account_type] ?? group.account_type}
                    </td>
                  </tr>

                  {/* Rows */}
                  {group.rows.map((row) => (
                    <tr key={row.account_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                        {row.account_code}
                      </td>
                      <td 
                        className="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap"
                        style={{ paddingLeft: `${(row.account_level - 1) * 16 + 16}px` }}
                      >
                        {row.account_name}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600 dark:text-gray-300">{formatRp(row.opening_debit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-600 dark:text-gray-300">{formatRp(row.opening_credit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{formatRp(row.period_debit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{formatRp(row.period_credit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">{formatRp(row.closing_debit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">{formatRp(row.closing_credit)}</td>
                    </tr>
                  ))}

                  {/* Subtotal */}
                  <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                    <td colSpan={2} className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Sub-total {ACCOUNT_TYPE_LABELS[group.account_type] ?? group.account_type}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700">{formatRp(group.subtotal_opening_debit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700">{formatRp(group.subtotal_opening_credit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-indigo-700 dark:text-indigo-300 border-t border-indigo-200 dark:border-indigo-800/50">{formatRp(group.subtotal_period_debit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-indigo-700 dark:text-indigo-300 border-t border-indigo-200 dark:border-indigo-800/50">{formatRp(group.subtotal_period_credit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-emerald-700 dark:text-emerald-300 border-t border-emerald-200 dark:border-emerald-800/50">{formatRp(group.subtotal_closing_debit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-emerald-700 dark:text-emerald-300 border-t border-emerald-200 dark:border-emerald-800/50">{formatRp(group.subtotal_closing_credit)}</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
              <tr>
                <td colSpan={2} className="px-4 py-4 text-right font-bold text-sm uppercase tracking-wider text-gray-900 dark:text-white">
                  Grand Total
                </td>
                <td className="px-4 py-4 text-right font-bold text-sm text-gray-900 dark:text-white">{formatRp(summary.total_opening_debit)}</td>
                <td className="px-4 py-4 text-right font-bold text-sm text-gray-900 dark:text-white">{formatRp(summary.total_opening_credit)}</td>
                <td className="px-4 py-4 text-right font-bold text-sm text-indigo-700 dark:text-indigo-400">{formatRp(summary.total_period_debit)}</td>
                <td className="px-4 py-4 text-right font-bold text-sm text-indigo-700 dark:text-indigo-400">{formatRp(summary.total_period_credit)}</td>
                <td className="px-4 py-4 text-right font-bold text-sm text-emerald-700 dark:text-emerald-400">{formatRp(summary.total_closing_debit)}</td>
                <td className="px-4 py-4 text-right font-bold text-sm text-emerald-700 dark:text-emerald-400">{formatRp(summary.total_closing_credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
