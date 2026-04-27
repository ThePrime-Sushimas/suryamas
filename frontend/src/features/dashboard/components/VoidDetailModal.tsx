import { useMemo } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface VoidRow {
  sales_date: string
  branch_name: string | null
  grand_total: number
  void_transaction_count: number
  skip_reason: string | null
}

interface VoidDetailModalProps {
  isOpen: boolean
  onClose: () => void
  data: VoidRow[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const fmtDateDisplay = (d: string) => {
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function parseSalesNums(skipReason: string | null): string[] {
  if (!skipReason) return []
  const match = skipReason.match(/:\s*(.+)$/)
  if (!match) return []
  return match[1].split(',').map(s => s.trim()).filter(Boolean)
}

export function VoidDetailModal({ isOpen, onClose, data }: VoidDetailModalProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, { branch: string; date: string; total: number; trx: number; salesNums: string[] }>()
    for (const r of data) {
      const key = `${r.sales_date}|${r.branch_name || 'Unknown'}`
      const existing = map.get(key)
      const nums = parseSalesNums(r.skip_reason)
      if (existing) {
        existing.total += r.grand_total
        existing.trx += r.void_transaction_count
        existing.salesNums.push(...nums)
      } else {
        map.set(key, {
          branch: r.branch_name || 'Unknown',
          date: r.sales_date,
          total: r.grand_total,
          trx: r.void_transaction_count,
          salesNums: nums,
        })
      }
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || a.branch.localeCompare(b.branch))
  }, [data])

  const totalVoid = useMemo(() => data.reduce((s, r) => s + r.grand_total, 0), [data])
  const totalTrx = useMemo(() => data.reduce((s, r) => s + r.void_transaction_count, 0), [data])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Detail Transaksi VOID</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-3 bg-rose-50 dark:bg-rose-900/20 flex gap-6 text-xs">
          <div>
            <span className="text-rose-500 dark:text-rose-400">Total VOID</span>
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{fmt(totalVoid)}</p>
          </div>
          <div>
            <span className="text-rose-500 dark:text-rose-400">Transaksi</span>
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{totalTrx} trx</p>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {grouped.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Tidak ada data VOID</p>
          ) : grouped.map((g, i) => (
            <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{g.branch}</span>
                  <span className="text-[10px] text-gray-400">{fmtDateDisplay(g.date)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{fmt(g.total)}</span>
                  <span className="text-[10px] text-gray-400 ml-2">{g.trx} trx</span>
                </div>
              </div>
              {g.salesNums.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {g.salesNums.map(sn => (
                    <span key={sn} className="text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded font-mono">
                      {sn}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
