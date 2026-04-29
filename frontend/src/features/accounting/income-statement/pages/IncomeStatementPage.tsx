import React, { useMemo, useState, useCallback } from 'react'
import { Download, AlertCircle, Search, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'
import { useIncomeStatement } from '../api/incomeStatement.api'
import { useIncomeStatementStore } from '../store/incomeStatement.store'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { escapeCsv } from '@/utils/csv.utils'
import type { IncomeStatementRow } from '../types/income-statement.types'

const BASE_COLS = 5
const COMPARE_EXTRA_COLS = 2

function fmt(v: number, showZero = false): string {
  if (v === 0) return showZero ? '0,00' : '-'
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function fmtCompact(v: number): string {
  if (v === 0) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function pctChange(current: number, compare: number): number | null {
  if (compare === 0 && current === 0) return null
  if (compare === 0) return current > 0 ? 100 : -100
  return Math.round(((current - compare) / Math.abs(compare)) * 100)
}

function revenueAmount(r: IncomeStatementRow): number {
  return Number(r.credit_amount) - Number(r.debit_amount)
}

function expenseAmount(r: IncomeStatementRow): number {
  return Number(r.debit_amount) - Number(r.credit_amount)
}

function rowAmount(r: IncomeStatementRow): number {
  return r.account_type === 'REVENUE' ? revenueAmount(r) : expenseAmount(r)
}

function compareRowAmount(r: IncomeStatementRow): number {
  return r.account_type === 'REVENUE'
    ? Number(r.compare_credit_amount) - Number(r.compare_debit_amount)
    : Number(r.compare_debit_amount) - Number(r.compare_credit_amount)
}

interface SubtypeGroup {
  subtype: string
  label: string
  rows: Array<IncomeStatementRow & { rowIndex: number }>
  total: number
  compareTotal: number
}

interface GroupedSection {
  type: 'REVENUE' | 'EXPENSE'
  label: string
  subtypes: SubtypeGroup[]
  total: number
  compareTotal: number
}

function groupRows(rows: IncomeStatementRow[]): GroupedSection[] {
  let idx = 0
  const sections: GroupedSection[] = []
  for (const type of ['REVENUE', 'EXPENSE'] as const) {
    const filtered = rows.filter(r => r.account_type === type)
    if (filtered.length === 0) continue

    const groupMap = new Map<string, Array<IncomeStatementRow & { rowIndex: number }>>()
    for (const r of filtered) {
      const key = r.parent_account_id ?? '__ungrouped__'
      if (!groupMap.has(key)) groupMap.set(key, [])
      idx++
      groupMap.get(key)!.push({ ...r, rowIndex: idx })
    }

    const subtypes: SubtypeGroup[] = [...groupMap.entries()].map(([key, grpRows]) => ({
      subtype: key,
      label: grpRows[0]?.parent_account_name ?? 'Lainnya',
      rows: grpRows,
      total: grpRows.reduce((s, r) => s + rowAmount(r), 0),
      compareTotal: grpRows.reduce((s, r) => s + compareRowAmount(r), 0),
    }))

    sections.push({
      type,
      label: type === 'REVENUE' ? 'Pendapatan' : 'Beban',
      subtypes,
      total: filtered.reduce((s, r) => s + rowAmount(r), 0),
      compareTotal: filtered.reduce((s, r) => s + compareRowAmount(r), 0),
    })
  }
  return sections
}

function exportCsv(rows: IncomeStatementRow[], dateFrom: string, dateTo: string, hasCompare: boolean) {
  const header = ['#', 'Type', 'Subtype', 'COA Code', 'Account Name', 'Branch', 'Amount',
    ...(hasCompare ? ['Compare Amount', 'Change %'] : [])].join(';')
  const lines = rows.map((r, i) => {
    const amt = rowAmount(r)
    const base = [i + 1, r.account_type, r.group_label || '', r.account_code, escapeCsv(r.account_name),
      escapeCsv(r.branch_name ?? 'All'), amt]
    if (hasCompare) {
      const cAmt = compareRowAmount(r)
      const pct = pctChange(amt, cAmt)
      base.push(cAmt, pct !== null ? `${pct}%` : '-')
    }
    return base.join(';')
  })
  const csv = [header, ...lines].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `income-statement_${dateFrom}_${dateTo}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function IncomeStatementPage() {
  const { branches, currentBranch } = useBranchContextStore()
  const { filter, setFilter } = useIncomeStatementStore()
  const [fetchKey, setFetchKey] = useState(0)
  const [isStale, setIsStale] = useState(false)
  const [showCompare, setShowCompare] = useState(false)

  const companyId = currentBranch?.company_id ?? ''
  const companyBranches = useMemo(
    () => branches.filter(b => b.company_id === companyId),
    [branches, companyId]
  )

  const activeFilter = useMemo(
    () => ({
      ...filter,
      compare_date_from: showCompare ? filter.compare_date_from : undefined,
      compare_date_to: showCompare ? filter.compare_date_to : undefined,
    }),
    [filter, showCompare]
  )

  const [appliedFilter, setAppliedFilter] = useState(activeFilter)
  const { data, isLoading, isError, error } = useIncomeStatement(appliedFilter, companyId, fetchKey > 0)

  const sections = useMemo(() => groupRows(data?.rows ?? []), [data])
  const summary = data?.summary
  const hasCompare = showCompare && !!filter.compare_date_from && !!filter.compare_date_to
  const totalCols = BASE_COLS + (hasCompare ? COMPARE_EXTRA_COLS : 0)

  const handleShow = useCallback(() => {
    setAppliedFilter({ ...activeFilter })
    setFetchKey(prev => prev + 1)
    setIsStale(false)
  }, [activeFilter])

  const handleFilterChange = useCallback((patch: Partial<typeof filter>) => {
    setFilter(patch)
    if (fetchKey > 0) setIsStale(true)
  }, [setFilter, fetchKey])

  const toggleBranch = useCallback((branchId: string) => {
    const current = filter.branch_ids
    const next = current.includes(branchId)
      ? current.filter(id => id !== branchId)
      : [...current, branchId]
    handleFilterChange({ branch_ids: next })
  }, [filter.branch_ids, handleFilterChange])

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Laba Rugi</h1>
        {summary && summary.net_income !== 0 && (
          <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border flex items-center gap-1.5 ${
            summary.net_income > 0
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
          }`}>
            {summary.net_income > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {summary.net_income > 0 ? 'Laba' : 'Rugi'}: {fmtCompact(Math.abs(summary.net_income))}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Periode</label>
            <div className="flex items-center gap-2">
              <input type="date" value={filter.date_from}
                onChange={e => handleFilterChange({ date_from: e.target.value })}
                className="h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
              <span className="text-gray-400">–</span>
              <input type="date" value={filter.date_to}
                onChange={e => handleFilterChange({ date_to: e.target.value })}
                className="h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {showCompare && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">Pembanding</label>
              <div className="flex items-center gap-2">
                <input type="date" value={filter.compare_date_from}
                  onChange={e => handleFilterChange({ compare_date_from: e.target.value })}
                  className="h-10 px-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500" />
                <span className="text-gray-400">–</span>
                <input type="date" value={filter.compare_date_to}
                  onChange={e => handleFilterChange({ compare_date_to: e.target.value })}
                  className="h-10 px-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
          )}

          <div className="flex-1" />

          <button onClick={() => { setShowCompare(v => !v); if (fetchKey > 0) setIsStale(true) }}
            className={`h-10 flex items-center gap-2 px-4 border rounded-lg text-sm font-medium transition-colors ${
              showCompare
                ? 'border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
            <ArrowUpDown size={16} />
            Bandingkan
          </button>

          <button onClick={handleShow} disabled={isLoading}
            className={`h-10 flex items-center gap-2 px-5 text-white rounded-lg disabled:opacity-50 transition-colors font-medium text-sm shadow-sm ${
              isStale ? 'bg-amber-600 hover:bg-amber-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            <Search size={16} />
            {isStale ? 'Update Report' : 'Show Report'}
          </button>

          {data && data.rows.length > 0 && (
            <button onClick={() => exportCsv(data.rows, filter.date_from, filter.date_to, hasCompare)}
              className="h-10 flex items-center gap-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium">
              <Download size={16} /> Export
            </button>
          )}
        </div>

        {/* Branch multi-select */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
            Branch {filter.branch_ids.length > 0 ? `(${filter.branch_ids.length} selected)` : '(All)'}
          </label>
          <div className="flex flex-wrap gap-2">
            {companyBranches.map(b => {
              const selected = filter.branch_ids.includes(b.branch_id)
              return (
                <button key={b.branch_id} onClick={() => toggleBranch(b.branch_id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}>
                  {b.branch_name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      {fetchKey === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Set filter lalu klik "Show Report"</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded" />)}
          </div>
        </div>
      ) : isError ? (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">{error instanceof Error && error.message.includes('400') ? error.message : 'Terjadi kesalahan. Silakan coba lagi.'}</p>
        </div>
      ) : data && data.rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Tidak ada data. Pastikan ada jurnal POSTED dalam periode ini.</p>
        </div>
      ) : data && (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard label="Total Pendapatan" value={summary.total_revenue} compare={hasCompare ? summary.compare_total_revenue : undefined} color="emerald" />
              <SummaryCard label="Total Beban" value={summary.total_expense} compare={hasCompare ? summary.compare_total_expense : undefined} color="rose" />
              <SummaryCard label="Laba / Rugi Bersih" value={summary.net_income} compare={hasCompare ? summary.compare_net_income : undefined} color={summary.net_income >= 0 ? 'emerald' : 'rose'} />
            </div>
          )}

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center w-10">#</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Kode</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Nama Akun</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Branch</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Jumlah</th>
                  {hasCompare && (
                    <>
                      <th className="px-3 py-2.5 text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase text-right">Pembanding</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center w-20">%</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {sections.map(section => (
                  <React.Fragment key={section.type}>
                    <tr className={`${section.type === 'REVENUE' ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-rose-50/50 dark:bg-rose-900/10'}`}>
                      <td colSpan={totalCols} className={`px-3 py-2 font-bold text-xs uppercase tracking-wider border-y ${
                        section.type === 'REVENUE'
                          ? 'text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50'
                          : 'text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50'
                      }`}>
                        {section.label}
                      </td>
                    </tr>
                    {section.subtypes.map(st => (
                      <React.Fragment key={st.subtype}>
                        <tr className="bg-gray-50/80 dark:bg-gray-800/60">
                          <td colSpan={totalCols} className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-6">
                            {st.label}
                          </td>
                        </tr>
                        {st.rows.map(r => {
                          const amount = rowAmount(r)
                          const cAmount = compareRowAmount(r)
                          const pct = hasCompare ? pctChange(amount, cAmount) : null
                          return (
                            <tr key={`${r.account_id}-${r.branch_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                              <td className="px-3 py-2 text-center text-xs text-gray-400">{r.rowIndex}</td>
                              <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100 whitespace-nowrap">{r.account_code}</td>
                              <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium">{r.account_name}</td>
                              <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{r.branch_name ?? '-'}</td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-gray-900 dark:text-gray-100 font-medium">{fmt(amount)}</td>
                              {hasCompare && (
                                <>
                                  <td className="px-3 py-2 text-right font-mono text-xs text-amber-600 dark:text-amber-400">{fmt(cAmount)}</td>
                                  <td className="px-3 py-2 text-center">
                                    {pct !== null && (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                        pct > 0 ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
                                        : pct < 0 ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30'
                                        : 'text-gray-400'
                                      }`}>
                                        {pct > 0 ? '+' : ''}{pct}%
                                      </span>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                        <tr className="bg-gray-50/30 dark:bg-gray-800/20">
                          <td colSpan={4} className="px-3 py-1.5 text-right text-[11px] font-medium text-gray-400 dark:text-gray-500 italic pl-8">
                            Sub-total {st.label}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-[11px] font-semibold text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700">{fmt(st.total)}</td>
                          {hasCompare && (
                            <>
                              <td className="px-3 py-1.5 text-right font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400 border-t border-gray-100 dark:border-gray-700">{fmt(st.compareTotal)}</td>
                              <td className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-700" />
                            </>
                          )}
                        </tr>
                      </React.Fragment>
                    ))}
                    <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                      <td colSpan={4} className="px-3 py-2.5 text-right font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">
                        Total {section.label}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-bold text-xs border-t-2 border-gray-300 dark:border-gray-600 ${
                        section.type === 'REVENUE' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                      }`}>{fmt(section.total)}</td>
                      {hasCompare && (
                        <>
                          <td className="px-3 py-2.5 text-right font-bold text-xs text-amber-700 dark:text-amber-400 border-t-2 border-gray-300 dark:border-gray-600">{fmt(section.compareTotal)}</td>
                          <td className="px-3 py-2.5 border-t-2 border-gray-300 dark:border-gray-600" />
                        </>
                      )}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              {summary && (
                <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-right font-bold text-sm uppercase text-gray-900 dark:text-white">
                      Laba / Rugi Bersih
                    </td>
                    <td className={`px-3 py-3 text-right font-bold text-sm ${
                      summary.net_income >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                    }`}>{fmt(Math.abs(summary.net_income), true)}</td>
                    {hasCompare && (
                      <>
                        <td className={`px-3 py-3 text-right font-bold text-sm ${
                          summary.compare_net_income >= 0 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'
                        }`}>{fmt(Math.abs(summary.compare_net_income), true)}</td>
                        <td className="px-3 py-3 text-center">
                          {(() => {
                            const pct = pctChange(summary.net_income, summary.compare_net_income)
                            if (pct === null) return null
                            return (
                              <span className={`text-xs font-bold ${pct > 0 ? 'text-emerald-600' : pct < 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                                {pct > 0 ? '+' : ''}{pct}%
                              </span>
                            )
                          })()}
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, compare, color }: { label: string; value: number; compare?: number; color: string }) {
  const pct = compare !== undefined ? pctChange(value, compare) : null
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    rose: 'text-rose-700 dark:text-rose-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorMap[color] ?? 'text-gray-900 dark:text-white'}`}>{fmtCompact(Math.abs(value))}</p>
      {compare !== undefined && pct !== null && (
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium mt-1 px-1.5 py-0.5 rounded-full ${
          pct > 0 ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30'
          : pct < 0 ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30'
          : 'text-gray-400 bg-gray-50 dark:bg-gray-700'
        }`}>
          {pct > 0 ? '+' : ''}{pct}% vs pembanding
        </span>
      )}
    </div>
  )
}
