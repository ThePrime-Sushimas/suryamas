import React, { useMemo, useState, useCallback } from 'react'
import { Download, AlertCircle, Search, ArrowUpDown, CheckCircle2, XCircle } from 'lucide-react'
import { useBalanceSheet } from '../api/balanceSheet.api'
import { useBalanceSheetStore } from '../store/balanceSheet.store'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { escapeCsv } from '@/utils/csv.utils'
import type { BalanceSheetRow } from '../types/balance-sheet.types'

const BASE_COLS = 5
const COMPARE_EXTRA_COLS = 2

const SECTION_COLORS = {
  blue: {
    bg: 'bg-blue-50/50 dark:bg-blue-900/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-100 dark:border-blue-900/50',
    totalText: 'text-blue-700 dark:text-blue-400',
  },
  amber: {
    bg: 'bg-amber-50/50 dark:bg-amber-900/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-900/50',
    totalText: 'text-amber-700 dark:text-amber-400',
  },
  violet: {
    bg: 'bg-violet-50/50 dark:bg-violet-900/10',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-100 dark:border-violet-900/50',
    totalText: 'text-violet-700 dark:text-violet-400',
  },
} as const

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

function assetBalance(r: BalanceSheetRow): number {
  return Number(r.debit_amount) - Number(r.credit_amount)
}

function liabilityEquityBalance(r: BalanceSheetRow): number {
  return Number(r.credit_amount) - Number(r.debit_amount)
}

function rowBalance(r: BalanceSheetRow): number {
  return r.account_type === 'ASSET' ? assetBalance(r) : liabilityEquityBalance(r)
}

function compareRowBalance(r: BalanceSheetRow): number {
  return r.account_type === 'ASSET'
    ? Number(r.compare_debit_amount) - Number(r.compare_credit_amount)
    : Number(r.compare_credit_amount) - Number(r.compare_debit_amount)
}

interface AccountGroup {
  key: string
  label: string
  rows: Array<BalanceSheetRow & { rowIndex: number }>
  total: number
  compareTotal: number
}

interface TypeSection {
  type: 'ASSET' | 'LIABILITY' | 'EQUITY'
  label: string
  groups: AccountGroup[]
  total: number
  compareTotal: number
}

const TYPE_ORDER: Array<'ASSET' | 'LIABILITY' | 'EQUITY'> = ['ASSET', 'LIABILITY', 'EQUITY']
const TYPE_LABELS: Record<string, string> = { ASSET: 'Aset', LIABILITY: 'Kewajiban', EQUITY: 'Ekuitas' }

function buildSections(rows: BalanceSheetRow[]): TypeSection[] {
  let idx = 0
  const sections: TypeSection[] = []

  for (const type of TYPE_ORDER) {
    const filtered = rows.filter(r => r.account_type === type)
    if (filtered.length === 0) continue

    const groupMap = new Map<string, Array<BalanceSheetRow & { rowIndex: number }>>()
    for (const r of filtered) {
      const key = r.parent_account_id ?? '__ungrouped__'
      if (!groupMap.has(key)) groupMap.set(key, [])
      idx++
      groupMap.get(key)!.push({ ...r, rowIndex: idx })
    }

    const groups: AccountGroup[] = [...groupMap.entries()].map(([key, grpRows]) => ({
      key,
      label: grpRows[0]?.parent_account_name ?? 'Lainnya',
      rows: grpRows,
      total: grpRows.reduce((s, r) => s + rowBalance(r), 0),
      compareTotal: grpRows.reduce((s, r) => s + compareRowBalance(r), 0),
    }))

    sections.push({
      type,
      label: TYPE_LABELS[type],
      groups,
      total: filtered.reduce((s, r) => s + rowBalance(r), 0),
      compareTotal: filtered.reduce((s, r) => s + compareRowBalance(r), 0),
    })
  }
  return sections
}

function exportCsv(rows: BalanceSheetRow[], asOfDate: string, hasCompare: boolean) {
  const header = ['#', 'Type', 'Group', 'COA Code', 'Account Name', 'Branch', 'Balance',
    ...(hasCompare ? ['Compare Balance', 'Change %'] : [])].join(';')
  const lines = rows.map((r, i) => {
    const bal = rowBalance(r)
    const base = [i + 1, r.account_type, r.group_label || '', r.account_code, escapeCsv(r.account_name),
      escapeCsv(r.branch_name ?? 'All'), bal]
    if (hasCompare) {
      const cBal = compareRowBalance(r)
      const pct = pctChange(bal, cBal)
      base.push(cBal, pct !== null ? `${pct}%` : '-')
    }
    return base.join(';')
  })
  const csv = [header, ...lines].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `balance-sheet_${asOfDate}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function BalanceSheetPage() {
  const { branches, currentBranch } = useBranchContextStore()
  const { filter, setFilter } = useBalanceSheetStore()
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
      compare_as_of_date: showCompare ? filter.compare_as_of_date : undefined,
    }),
    [filter, showCompare]
  )

  const [appliedFilter, setAppliedFilter] = useState(activeFilter)
  const { data, isLoading, isError, error } = useBalanceSheet(appliedFilter, companyId, fetchKey > 0)

  const sections = useMemo(() => buildSections(data?.rows ?? []), [data])
  const summary = data?.summary
  const hasCompare = showCompare && !!filter.compare_as_of_date
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Neraca</h1>
        {summary && (
          <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border flex items-center gap-1.5 ${
            summary.is_balanced
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
          }`}>
            {summary.is_balanced ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {summary.is_balanced ? 'Balance' : 'Tidak Balance'}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Per Tanggal</label>
            <input type="date" value={filter.as_of_date}
              onChange={e => handleFilterChange({ as_of_date: e.target.value })}
              className="h-10 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
          </div>

          {showCompare && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">Pembanding</label>
              <input type="date" value={filter.compare_as_of_date}
                onChange={e => handleFilterChange({ compare_as_of_date: e.target.value })}
                className="h-10 px-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500" />
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
            <button onClick={() => exportCsv(data.rows, filter.as_of_date, hasCompare)}
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
          <p className="text-gray-500 dark:text-gray-400 font-medium">Set tanggal lalu klik "Show Report"</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded" />)}
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
          <p className="text-gray-500 dark:text-gray-400">Tidak ada data. Pastikan ada jurnal POSTED sampai tanggal ini.</p>
        </div>
      ) : data && (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-4">
              <SummaryCard label="Total Aset" value={summary.total_asset} compare={hasCompare ? summary.compare_total_asset : undefined} color="blue" />
              <SummaryCard label="Total Kewajiban" value={summary.total_liability} compare={hasCompare ? summary.compare_total_liability : undefined} color="amber" />
              <SummaryCard label="Total Ekuitas" value={summary.total_equity + summary.retained_earnings} compare={hasCompare ? summary.compare_total_equity + summary.compare_retained_earnings : undefined} color="violet" />
              <SummaryCard label="Laba Ditahan" value={summary.retained_earnings} compare={hasCompare ? summary.compare_retained_earnings : undefined} color="emerald" />
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
                  <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Saldo</th>
                  {hasCompare && (
                    <>
                      <th className="px-3 py-2.5 text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase text-right">Pembanding</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center w-20">%</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {sections.map(section => {
                  const sectionColor = section.type === 'ASSET' ? 'blue' : section.type === 'LIABILITY' ? 'amber' : 'violet'
                  const colors = SECTION_COLORS[sectionColor]
                  return (
                    <React.Fragment key={section.type}>
                      <tr className={colors.bg}>
                        <td colSpan={totalCols} className={`px-3 py-2 font-bold text-xs uppercase tracking-wider border-y ${colors.text} ${colors.border}`}>
                          {section.label}
                        </td>
                      </tr>
                      {section.groups.map(grp => (
                        <React.Fragment key={grp.key}>
                          <tr className="bg-gray-50/80 dark:bg-gray-800/60">
                            <td colSpan={totalCols} className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-6">
                              {grp.label}
                            </td>
                          </tr>
                          {grp.rows.map(r => {
                            const bal = rowBalance(r)
                            const cBal = compareRowBalance(r)
                            const pct = hasCompare ? pctChange(bal, cBal) : null
                            return (
                              <tr key={`${r.account_id}-${r.branch_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-3 py-2 text-center text-xs text-gray-400">{r.rowIndex}</td>
                                <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100 whitespace-nowrap">{r.account_code}</td>
                                <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium">{r.account_name}</td>
                                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{r.branch_name ?? '-'}</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-gray-900 dark:text-gray-100 font-medium">{fmt(bal)}</td>
                                {hasCompare && (
                                  <>
                                    <td className="px-3 py-2 text-right font-mono text-xs text-amber-600 dark:text-amber-400">{fmt(cBal)}</td>
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
                              Sub-total {grp.label}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-[11px] font-semibold text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700">{fmt(grp.total)}</td>
                            {hasCompare && (
                              <>
                                <td className="px-3 py-1.5 text-right font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400 border-t border-gray-100 dark:border-gray-700">{fmt(grp.compareTotal)}</td>
                                <td className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-700" />
                              </>
                            )}
                          </tr>
                        </React.Fragment>
                      ))}
                      {/* Section total */}
                      <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                        <td colSpan={4} className="px-3 py-2.5 text-right font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">
                          Total {section.label}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-bold text-xs border-t-2 border-gray-300 dark:border-gray-600 ${colors.totalText}`}>
                          {fmt(section.total, true)}
                        </td>
                        {hasCompare && (
                          <>
                            <td className="px-3 py-2.5 text-right font-bold text-xs text-amber-700 dark:text-amber-400 border-t-2 border-gray-300 dark:border-gray-600">{fmt(section.compareTotal, true)}</td>
                            <td className="px-3 py-2.5 border-t-2 border-gray-300 dark:border-gray-600" />
                          </>
                        )}
                      </tr>
                    </React.Fragment>
                  )
                })}

                {/* Retained Earnings row */}
                {summary && (
                  <tr className="bg-emerald-50/30 dark:bg-emerald-900/10">
                    <td colSpan={4} className="px-3 py-2.5 text-right font-semibold text-xs text-emerald-700 dark:text-emerald-400">
                      Laba Ditahan (dari Laba Rugi)
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs text-emerald-700 dark:text-emerald-400">{fmt(summary.retained_earnings, true)}</td>
                    {hasCompare && (
                      <>
                        <td className="px-3 py-2.5 text-right font-bold text-xs text-amber-700 dark:text-amber-400">{fmt(summary.compare_retained_earnings, true)}</td>
                        <td className="px-3 py-2.5" />
                      </>
                    )}
                  </tr>
                )}
              </tbody>

              {/* Footer */}
              {summary && (
                <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-right font-bold text-sm uppercase text-gray-900 dark:text-white">Total Aset</td>
                    <td className="px-3 py-3 text-right font-bold text-sm text-blue-700 dark:text-blue-400">{fmt(Math.abs(summary.total_asset), true)}</td>
                    {hasCompare && (
                      <>
                        <td className="px-3 py-3 text-right font-bold text-sm text-amber-700 dark:text-amber-400">{fmt(Math.abs(summary.compare_total_asset), true)}</td>
                        <td className="px-3 py-3" />
                      </>
                    )}
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-right font-bold text-sm uppercase text-gray-900 dark:text-white">Total Kewajiban + Ekuitas</td>
                    <td className="px-3 py-3 text-right font-bold text-sm text-violet-700 dark:text-violet-400">{fmt(Math.abs(summary.total_liability_equity), true)}</td>
                    {hasCompare && (
                      <>
                        <td className="px-3 py-3 text-right font-bold text-sm text-amber-700 dark:text-amber-400">{fmt(Math.abs(summary.compare_total_liability_equity), true)}</td>
                        <td className="px-3 py-3" />
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
    blue: 'text-blue-700 dark:text-blue-400',
    amber: 'text-amber-700 dark:text-amber-400',
    violet: 'text-violet-700 dark:text-violet-400',
    emerald: 'text-emerald-700 dark:text-emerald-400',
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorMap[color] ?? 'text-gray-900 dark:text-white'}`}>{fmtCompact(Math.abs(value))}</p>
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
