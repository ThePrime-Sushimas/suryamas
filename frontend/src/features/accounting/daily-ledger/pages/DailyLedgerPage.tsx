import React, { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Search, Download } from 'lucide-react'
import api from '@/lib/axios'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

// Types
interface Movement {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  parent_account_code: string | null
  parent_account_name: string | null
  journal_date: string
  debit_amount: number
  credit_amount: number
}

interface Opening {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  parent_account_code: string | null
  parent_account_name: string | null
  opening_debit: number
  opening_credit: number
}

interface AccountRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  parent_account_code: string | null
  parent_account_name: string | null
  opening_balance: number // net: debit - credit (positive = debit balance)
  daily: Record<string, number> // date → net movement
  cumulative: number[] // pre-computed cumulative per date index
}

type ViewMode = 'movement' | 'cumulative'

const TYPE_LABELS: Record<string, string> = {
  ASSET: 'Aset', LIABILITY: 'Kewajiban', EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan', EXPENSE: 'Beban',
}
const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']

function fmt(v: number): string {
  if (Math.abs(v) < 0.005) return '-'
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function getDateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const d = new Date(from)
  const end = new Date(to)
  const pad = (n: number) => String(n).padStart(2, '0')
  while (d <= end) {
    dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function getLocalMonth(): { first: string; last: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const first = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDate = new Date(y, m + 1, 0)
  const last = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
  return { first, last }
}

export default function DailyLedgerPage() {
  const { branches } = useBranchContextStore()

  const { first, last } = useMemo(() => getLocalMonth(), [])
  const [dateFrom, setDateFrom] = useState(first)
  const [dateTo, setDateTo] = useState(last)
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('movement')
  const [fetchKey, setFetchKey] = useState(0)
  const [appliedParams, setAppliedParams] = useState({ dateFrom: '', dateTo: '', branchIds: [] as string[] })

  const { data, isLoading } = useQuery({
    queryKey: ['daily-ledger', appliedParams, fetchKey],
    queryFn: async () => {
      const params: Record<string, string> = { date_from: appliedParams.dateFrom, date_to: appliedParams.dateTo }
      if (appliedParams.branchIds.length > 0) params.branch_ids = appliedParams.branchIds.join(',')
      const { data: res } = await api.get('/accounting/daily-ledger', { params })
      return res.data as { movements: Movement[]; openings: Opening[] }
    },
    enabled: fetchKey > 0,
  })

  const handleShow = useCallback(() => {
    setAppliedParams({ dateFrom, dateTo, branchIds })
    setFetchKey(k => k + 1)
  }, [dateFrom, dateTo, branchIds])

  // Build pivot data
  const { rows, dates, grouped } = useMemo(() => {
    if (!data) return { rows: [] as AccountRow[], dates: [] as string[], grouped: [] as { type: string; rows: AccountRow[] }[] }

    const dates = getDateRange(appliedParams.dateFrom, appliedParams.dateTo)

    // Build account map
    const accountMap = new Map<string, AccountRow>()

    // Opening balances
    for (const o of data.openings) {
      accountMap.set(o.account_id, {
        account_id: o.account_id,
        account_code: o.account_code,
        account_name: o.account_name,
        account_type: o.account_type,
        parent_account_code: o.parent_account_code,
        parent_account_name: o.parent_account_name,
        opening_balance: o.opening_debit - o.opening_credit,
        daily: {},
        cumulative: [],
      })
    }

    // Daily movements
    for (const m of data.movements) {
      if (!accountMap.has(m.account_id)) {
        accountMap.set(m.account_id, {
          account_id: m.account_id,
          account_code: m.account_code,
          account_name: m.account_name,
          account_type: m.account_type,
          parent_account_code: m.parent_account_code,
          parent_account_name: m.parent_account_name,
          opening_balance: 0,
          daily: {},
          cumulative: [],
        })
      }
      const row = accountMap.get(m.account_id)!
      const net = m.debit_amount - m.credit_amount
      row.daily[m.journal_date] = (row.daily[m.journal_date] || 0) + net
    }

    // Pre-compute cumulative for each account
    for (const row of accountMap.values()) {
      let cum = row.opening_balance
      row.cumulative = dates.map(d => {
        cum += row.daily[d] || 0
        return cum
      })
    }

    const rows = Array.from(accountMap.values()).sort((a, b) => a.account_code.localeCompare(b.account_code))

    // Group by type
    const grouped = TYPE_ORDER
      .map(type => ({ type, rows: rows.filter(r => r.account_type === type) }))
      .filter(g => g.rows.length > 0)

    return { rows, dates, grouped }
  }, [data, appliedParams])

  const toggleBranch = (id: string) => {
    setBranchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const getCellValue = (row: AccountRow, dateIdx: number): number => {
    if (viewMode === 'movement') return row.daily[dates[dateIdx]] || 0
    return row.cumulative[dateIdx] ?? 0
  }

  const handleExport = () => {
    const header = ['Akun', 'Tipe', ...(viewMode === 'cumulative' ? ['Opening'] : []), ...dates.map(d => d.slice(5))].join(';')
    const lines = rows.map(r => {
      const cells = dates.map((_, i) => getCellValue(r, i))
      const row = [
        `"${r.account_code} - ${r.account_name}"`,
        r.account_type,
        ...(viewMode === 'cumulative' ? [r.opening_balance] : []),
        ...cells,
      ]
      return row.join(';')
    })
    const csv = [header, ...lines].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `daily-ledger_${appliedParams.dateFrom}_${appliedParams.dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const formatDateHeader = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Daily Ledger</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Pergerakan saldo harian per akun</p>
            </div>
          </div>
          {rows.length > 0 && (
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Periode</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-8 px-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
              <span className="text-gray-400 text-xs">–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-8 px-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode(v => v === 'movement' ? 'cumulative' : 'movement')}
              className={`h-8 px-3 text-[11px] font-medium rounded-lg border transition-colors ${
                viewMode === 'cumulative'
                  ? 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}>
              {viewMode === 'cumulative' ? 'Kumulatif' : 'Movement'}
            </button>
            <button onClick={handleShow} disabled={isLoading}
              className="h-8 flex items-center gap-1.5 px-4 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Search className="w-3.5 h-3.5" />
              Tampilkan
            </button>
          </div>
        </div>

        {/* Branch filter */}
        <div className="flex flex-wrap gap-1.5">
          {branches.map(b => (
            <button key={b.branch_id} onClick={() => toggleBranch(b.branch_id)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                branchIds.includes(b.branch_id)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}>
              {b.branch_name}
            </button>
          ))}
          {branchIds.length > 0 && (
            <span className="text-[10px] text-gray-400 self-center ml-1">({branchIds.length} dipilih)</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {fetchKey === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Pilih periode lalu klik "Tampilkan"</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Tidak ada data dalam periode ini</p>
          </div>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-r border-gray-200 dark:border-gray-700 min-w-[200px]">
                  Akun
                </th>
                {viewMode === 'cumulative' && (
                  <th className="px-2 py-2 text-right font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-20 whitespace-nowrap bg-amber-50 dark:bg-amber-900/10">
                    Opening
                  </th>
                )}
                {dates.map(d => (
                  <th key={d} className="px-2 py-2 text-right font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[75px] whitespace-nowrap">
                    {formatDateHeader(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(g => (
                <React.Fragment key={g.type}>
                  <tr key={`type-${g.type}`} className="bg-blue-50/50 dark:bg-blue-900/10">
                    <td colSpan={dates.length + (viewMode === 'cumulative' ? 2 : 1)} className="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 border-y border-blue-100 dark:border-blue-900/50">
                      {TYPE_LABELS[g.type] ?? g.type}
                    </td>
                  </tr>
                  {g.rows.map((row, idx) => (
                    <tr key={row.account_id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'} hover:bg-blue-50/30 dark:hover:bg-blue-900/5`}>
                      <td className="sticky left-0 z-10 px-3 py-1.5 border-r border-gray-100 dark:border-gray-700 bg-inherit">
                        <span className="font-mono text-gray-400 mr-1.5">{row.account_code}</span>
                        <span className="text-gray-900 dark:text-white">{row.account_name}</span>
                      </td>
                      {viewMode === 'cumulative' && (
                        <td className="px-2 py-1.5 text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/5">
                          {fmt(row.opening_balance)}
                        </td>
                      )}
                      {dates.map((_, i) => {
                        const val = getCellValue(row, i)
                        return (
                          <td key={i} className={`px-2 py-1.5 text-right font-mono ${
                            val > 0 ? 'text-emerald-700 dark:text-emerald-400' :
                            val < 0 ? 'text-red-600 dark:text-red-400' :
                            'text-gray-300 dark:text-gray-600'
                          }`}>
                            {fmt(val)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
