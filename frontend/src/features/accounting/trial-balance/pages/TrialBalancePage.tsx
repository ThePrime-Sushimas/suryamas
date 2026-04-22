import React, { useMemo, useState, useCallback } from 'react'
import { Download, AlertCircle, Search } from 'lucide-react'
import { useTrialBalance } from '../api/trialBalance.api'
import { useTrialBalanceStore } from '../store/trialBalance.store'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import type { TrialBalanceRow, TrialBalanceSummary } from '../types/trial-balance.types'

const TYPE_LABELS: Record<string, string> = {
  ASSET: 'Aset', LIABILITY: 'Kewajiban', EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan', EXPENSE: 'Beban',
}
const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

function fmt(v: number): string {
  if (v === 0) return '-'
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function buildSummary(rows: TrialBalanceRow[]): TrialBalanceSummary {
  const s = (f: keyof TrialBalanceRow) => rows.reduce((a, r) => a + (r[f] as number), 0)
  const od = s('opening_debit'), oc = s('opening_credit')
  const pd = s('period_debit'), pc = s('period_credit')
  const cd = s('closing_debit'), cc = s('closing_credit')
  return {
    total_opening_debit: od, total_opening_credit: oc,
    total_period_debit: pd, total_period_credit: pc,
    total_closing_debit: cd, total_closing_credit: cc,
    is_balanced: Math.abs(cd - cc) < 0.01,
  }
}

interface GroupedRow {
  account_type: string
  rows: TrialBalanceRow[]
  subtotals: { od: number; oc: number; pd: number; pc: number; cd: number; cc: number }
}

function groupRows(rows: TrialBalanceRow[]): GroupedRow[] {
  const map = new Map<string, TrialBalanceRow[]>()
  for (const r of rows) {
    if (!map.has(r.account_type)) map.set(r.account_type, [])
    map.get(r.account_type)!.push(r)
  }
  return TYPE_ORDER.filter(t => map.has(t)).map(t => {
    const gr = map.get(t)!
    return {
      account_type: t, rows: gr,
      subtotals: {
        od: gr.reduce((s, r) => s + r.opening_debit, 0),
        oc: gr.reduce((s, r) => s + r.opening_credit, 0),
        pd: gr.reduce((s, r) => s + r.period_debit, 0),
        pc: gr.reduce((s, r) => s + r.period_credit, 0),
        cd: gr.reduce((s, r) => s + r.closing_debit, 0),
        cc: gr.reduce((s, r) => s + r.closing_credit, 0),
      },
    }
  })
}

function exportCsv(rows: TrialBalanceRow[], dateFrom: string, dateTo: string) {
  const header = ['#', 'COA 3 No', 'COA 3 Description', 'COA 4 No', 'COA 4 Description',
    'Branch', 'Currency', 'Opening Debit', 'Opening Credit', 'Mutation Debit',
    'Mutation Credit', 'Ending Debit', 'Ending Credit'].join(';')
  const lines = rows.map((r, i) => [
    i + 1, r.parent_account_code ?? '', `"${r.parent_account_name ?? ''}"`,
    r.account_code, `"${r.account_name}"`, `"${r.branch_name ?? 'All'}"`, r.currency,
    r.opening_debit, r.opening_credit, r.period_debit, r.period_credit,
    r.closing_debit, r.closing_credit,
  ].join(';'))
  const csv = [header, ...lines].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `trial-balance_${dateFrom}_${dateTo}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function TrialBalancePage() {
  const { branches, currentBranch } = useBranchContextStore()
  const { filter, setFilter } = useTrialBalanceStore()
  const [shouldFetch, setShouldFetch] = useState(false)

  const companyId = currentBranch?.company_id ?? ''
  const companyBranches = useMemo(
    () => branches.filter(b => b.company_id === companyId),
    [branches, companyId]
  )

  const activeFilter = useMemo(
    () => ({ ...filter, company_id: companyId }),
    [filter, companyId]
  )

  const { data: rows = [], isLoading, isError, error } = useTrialBalance(activeFilter, shouldFetch)

  const groups = useMemo(() => groupRows(rows), [rows])
  const summary = useMemo(() => buildSummary(rows), [rows])

  const handleShow = useCallback(() => setShouldFetch(true), [])
  const handleFilterChange = useCallback((patch: Partial<typeof filter>) => {
    setFilter(patch)
    setShouldFetch(false)
  }, [setFilter])

  const toggleBranch = useCallback((branchId: string) => {
    const current = filter.branch_ids
    const next = current.includes(branchId)
      ? current.filter(id => id !== branchId)
      : [...current, branchId]
    handleFilterChange({ branch_ids: next })
  }, [filter.branch_ids, handleFilterChange])

  let rowNum = 0

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trial Balance Report</h1>
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

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Period</label>
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

          <div className="flex-1" />

          <button onClick={handleShow} disabled={isLoading}
            className="h-10 flex items-center gap-2 px-5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium text-sm shadow-sm">
            <Search size={16} />
            Show Report
          </button>

          {rows.length > 0 && (
            <button onClick={() => exportCsv(rows, filter.date_from, filter.date_to)}
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
      {!shouldFetch ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Set filter lalu klik "Show Report"</p>
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
          <p className="text-red-600 dark:text-red-400">{error instanceof Error ? error.message : 'Error'}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Tidak ada data. Pastikan ada jurnal POSTED dalam periode ini.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th rowSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center w-10">#</th>
                <th rowSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">COA 3 No</th>
                <th rowSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">COA 3 Description</th>
                <th rowSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">COA 4 No</th>
                <th rowSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">COA 4 Description</th>
                <th rowSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-left">Branch</th>
                <th rowSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center w-16">Ccy</th>
                <th colSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-center border-b border-gray-200 dark:border-gray-700">Opening Value</th>
                <th colSpan={2} className="px-3 py-2 text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase text-center border-b border-gray-200 dark:border-gray-700">Mutation Value</th>
                <th colSpan={2} className="px-3 py-2 text-xs font-semibold text-emerald-500 dark:text-emerald-400 uppercase text-center border-b border-gray-200 dark:border-gray-700">Ending Value</th>
              </tr>
              <tr>
                <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Debit</th>
                <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Credit</th>
                <th className="px-3 py-1.5 text-xs font-semibold text-indigo-500 dark:text-indigo-400 text-right">Debit</th>
                <th className="px-3 py-1.5 text-xs font-semibold text-indigo-500 dark:text-indigo-400 text-right">Credit</th>
                <th className="px-3 py-1.5 text-xs font-semibold text-emerald-500 dark:text-emerald-400 text-right">Debit</th>
                <th className="px-3 py-1.5 text-xs font-semibold text-emerald-500 dark:text-emerald-400 text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {groups.map(g => (
                <React.Fragment key={g.account_type}>
                  <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                    <td colSpan={13} className="px-3 py-2 font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 border-y border-blue-100 dark:border-blue-900/50">
                      {TYPE_LABELS[g.account_type] ?? g.account_type}
                    </td>
                  </tr>
                  {g.rows.map(r => {
                    rowNum++
                    return (
                      <tr key={`${r.account_id}-${r.branch_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-3 py-2 text-center text-xs text-gray-400">{rowNum}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.parent_account_code ?? ''}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{r.parent_account_name ?? ''}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100 whitespace-nowrap">{r.account_code}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">{r.account_name}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">{r.branch_name ?? '-'}</td>
                        <td className="px-3 py-2 text-center text-xs text-gray-400">{r.currency}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-600 dark:text-gray-300">{fmt(r.opening_debit)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-gray-600 dark:text-gray-300">{fmt(r.opening_credit)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400">{fmt(r.period_debit)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400">{fmt(r.period_credit)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">{fmt(r.closing_debit)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium">{fmt(r.closing_credit)}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-gray-50/50 dark:bg-gray-800/30">
                    <td colSpan={7} className="px-3 py-2.5 text-right font-semibold text-xs uppercase text-gray-500 dark:text-gray-400">
                      Sub-total {TYPE_LABELS[g.account_type]}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700">{fmt(g.subtotals.od)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700">{fmt(g.subtotals.oc)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs text-indigo-700 dark:text-indigo-300 border-t border-indigo-200 dark:border-indigo-800/50">{fmt(g.subtotals.pd)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs text-indigo-700 dark:text-indigo-300 border-t border-indigo-200 dark:border-indigo-800/50">{fmt(g.subtotals.pc)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs text-emerald-700 dark:text-emerald-300 border-t border-emerald-200 dark:border-emerald-800/50">{fmt(g.subtotals.cd)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs text-emerald-700 dark:text-emerald-300 border-t border-emerald-200 dark:border-emerald-800/50">{fmt(g.subtotals.cc)}</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
              <tr>
                <td colSpan={7} className="px-3 py-3 text-right font-bold text-sm uppercase text-gray-900 dark:text-white">Grand Total</td>
                <td className="px-3 py-3 text-right font-bold text-sm text-gray-900 dark:text-white">{fmt(summary.total_opening_debit)}</td>
                <td className="px-3 py-3 text-right font-bold text-sm text-gray-900 dark:text-white">{fmt(summary.total_opening_credit)}</td>
                <td className="px-3 py-3 text-right font-bold text-sm text-indigo-700 dark:text-indigo-400">{fmt(summary.total_period_debit)}</td>
                <td className="px-3 py-3 text-right font-bold text-sm text-indigo-700 dark:text-indigo-400">{fmt(summary.total_period_credit)}</td>
                <td className="px-3 py-3 text-right font-bold text-sm text-emerald-700 dark:text-emerald-400">{fmt(summary.total_closing_debit)}</td>
                <td className="px-3 py-3 text-right font-bold text-sm text-emerald-700 dark:text-emerald-400">{fmt(summary.total_closing_credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
