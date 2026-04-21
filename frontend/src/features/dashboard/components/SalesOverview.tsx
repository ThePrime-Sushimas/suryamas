import { useMemo, useState } from 'react'
import { TrendingUp, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

interface SalesRow {
  branch_name: string | null
  payment_methods: { id: number; name: string; payment_type: string } | null
  grand_total: number
  nett_amount: number
  transaction_count: number
  total_fee_amount: number
  is_reconciled: boolean
}

interface Props {
  data: SalesRow[]
  isLoading: boolean
  isFetching: boolean
  onRefresh: () => void
}

export function SalesOverview({ data, isLoading, isFetching, onRefresh }: Props) {
  const [openBranches, setOpenBranches] = useState<Set<string>>(new Set())

  const grouped = useMemo(() => {
    const map = new Map<string, { rows: SalesRow[]; total: number; nett: number; trx: number; fee: number }>()
    for (const row of data) {
      const branch = row.branch_name || 'Unknown'
      if (!map.has(branch)) map.set(branch, { rows: [], total: 0, nett: 0, trx: 0, fee: 0 })
      const g = map.get(branch)!
      g.rows.push(row)
      g.total += row.grand_total
      g.nett += row.nett_amount
      g.trx += row.transaction_count
      g.fee += row.total_fee_amount
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [data])

  const grandTotal = useMemo(() => data.reduce((s, r) => s + r.grand_total, 0), [data])
  const grandTrx = useMemo(() => data.reduce((s, r) => s + r.transaction_count, 0), [data])

  const toggle = (branch: string) => {
    setOpenBranches(prev => {
      const n = new Set(prev)
      n.has(branch) ? n.delete(branch) : n.add(branch)
      return n
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Live Penjualan</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{grandTrx} trx</span>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmt(grandTotal)}</span>
          <button onClick={onRefresh} disabled={isFetching} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">Belum ada data penjualan hari ini</div>
      ) : (
        <div>
          {grouped.map(([branch, g]) => {
            const isOpen = openBranches.has(branch)
            return (
              <div key={branch} className="border-b border-gray-50 dark:border-gray-700 last:border-0">
                <button onClick={() => toggle(branch)} className="w-full flex items-center px-4 sm:px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors text-left">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{branch}</span>
                    <span className="text-xs text-gray-400 shrink-0">{g.trx} trx</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 shrink-0 ml-2">{fmt(g.total)}</span>
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-3 space-y-1">
                    {g.rows.map((row, i) => (
                      <div key={i} className="flex items-center gap-2 py-1.5 pl-6">
                        <span className="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">{row.payment_methods?.name || 'Unknown'}</span>
                        <span className="text-xs text-gray-400 shrink-0">{row.transaction_count} trx</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 w-28 text-right shrink-0">{fmt(row.grand_total)}</span>
                      </div>
                    ))}
                    {g.fee > 0 && (
                      <div className="flex items-center gap-2 py-1.5 pl-6 border-t border-gray-100 dark:border-gray-700 mt-1 pt-2">
                        <span className="flex-1 text-xs text-gray-400">Fee</span>
                        <span className="text-xs text-rose-500">{fmt(g.fee)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
