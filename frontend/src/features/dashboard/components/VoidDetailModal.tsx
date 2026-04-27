import { useState, useMemo, useEffect, useCallback } from 'react'
import { X, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import api from '@/lib/axios'

interface VoidRow {
  sales_date: string
  branch_name: string | null
  grand_total: number
  void_transaction_count: number
  skip_reason: string | null
}

interface VoidSaleDetail {
  sales_num: string
  sales_date: string
  sales_date_in: string | null
  sales_date_out: string | null
  branch_id: number
  queue_num: string | null
  pax_total: number
  subtotal: number
  discount_total: number
  vat_total: number
  grand_total: number
  additional_info: string | null
  created_by: string | null
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

const fmtTime = (d: string | null) => {
  if (!d) return '-'
  const t = d.split(' ')[1]
  return t ? t.slice(0, 5) : '-'
}

function parseSalesNums(skipReason: string | null): string[] {
  if (!skipReason) return []
  const match = skipReason.match(/:\s*(.+)$/)
  if (!match) return []
  return match[1].split(',').map(s => s.trim()).filter(Boolean)
}

export function VoidDetailModal({ isOpen, onClose, data }: VoidDetailModalProps) {
  const [details, setDetails] = useState<VoidSaleDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const allSalesNums = useMemo(() => {
    const nums: string[] = []
    for (const r of data) nums.push(...parseSalesNums(r.skip_reason))
    return [...new Set(nums)]
  }, [data])

  useEffect(() => {
    if (!isOpen || allSalesNums.length === 0) { setDetails([]); return }
    setLoading(true)
    api.post('/pos-sync-aggregates/void-details', { sales_nums: allSalesNums })
      .then(res => setDetails(res.data.data ?? []))
      .catch(() => setDetails([]))
      .finally(() => setLoading(false))
  }, [isOpen, allSalesNums])

  const grouped = useMemo(() => {
    const map = new Map<string, { branch: string; date: string; total: number; trx: number; salesNums: string[] }>()
    for (const r of data) {
      const key = `${r.sales_date}|${r.branch_name || 'Unknown'}`
      const nums = parseSalesNums(r.skip_reason)
      const existing = map.get(key)
      if (existing) {
        existing.total += r.grand_total
        existing.trx += r.void_transaction_count
        existing.salesNums.push(...nums)
      } else {
        map.set(key, { branch: r.branch_name || 'Unknown', date: r.sales_date, total: r.grand_total, trx: r.void_transaction_count, salesNums: nums })
      }
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date) || a.branch.localeCompare(b.branch))
  }, [data])

  const detailMap = useMemo(() => {
    const m = new Map<string, VoidSaleDetail>()
    for (const d of details) m.set(d.sales_num, d)
    return m
  }, [details])

  const totalVoid = useMemo(() => data.reduce((s, r) => s + r.grand_total, 0), [data])
  const totalTrx = useMemo(() => data.reduce((s, r) => s + r.void_transaction_count, 0), [data])

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Detail Transaksi VOID</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-3 bg-rose-50 dark:bg-rose-900/20 flex gap-6 text-xs shrink-0">
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
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {grouped.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Tidak ada data VOID</p>
          ) : grouped.map((g) => {
            const key = `${g.date}|${g.branch}`
            const isExpanded = expandedGroups.has(key)
            return (
              <div key={key} className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Group header — clickable */}
                <button onClick={() => toggleGroup(key)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{g.branch}</span>
                    <span className="text-[10px] text-gray-400">{fmtDateDisplay(g.date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-400">{g.trx} trx</span>
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{fmt(g.total)}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                    {loading ? (
                      <div className="px-3 py-4 space-y-2">
                        {[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}
                      </div>
                    ) : g.salesNums.length === 0 ? (
                      <p className="px-3 py-3 text-[10px] text-gray-400">Tidak ada detail sales number</p>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {g.salesNums.map(sn => {
                          const d = detailMap.get(sn)
                          return (
                            <div key={sn} className="px-3 py-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-mono font-medium text-gray-700 dark:text-gray-300">{sn}</span>
                                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{d ? fmt(Number(d.grand_total)) : '-'}</span>
                              </div>
                              {d ? (
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                                  {d.queue_num && <span>Queue: #{d.queue_num}</span>}
                                  <span>Masuk: {fmtTime(d.sales_date_in)}</span>
                                  <span>Keluar: {fmtTime(d.sales_date_out)}</span>
                                  <span>Pax: {d.pax_total}</span>
                                  <span>Subtotal: {fmt(Number(d.subtotal))}</span>
                                  {Number(d.discount_total) > 0 && <span>Disc: {fmt(Number(d.discount_total))}</span>}
                                  <span>PPN: {fmt(Number(d.vat_total))}</span>
                                  {d.created_by && <span>By: {d.created_by}</span>}
                                </div>
                              ) : (
                                <p className="text-[10px] text-gray-400">Detail tidak ditemukan</p>
                              )}
                              {d?.additional_info && (
                                <p className="mt-1 text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-2 py-1 rounded inline-block">
                                  {d.additional_info}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
