import React, { useState, useMemo } from 'react'
import { useCogsBreakdown, type CategoryBreakdownRow, type GroupBreakdownRow, type MenuBreakdownRow, type DailyCogsRow } from '../api/cogs-breakdown.api'
import { useBranchContextStore } from '@/features/branch_context'
import { ChevronDown, ChevronRight, TrendingUp, Calendar, Layers, BarChart3 } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
const fmtPct = (n: number) => `${n.toFixed(1)}%`
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

function PctBadge({ value }: { value: number }) {
  const color = value >= 50 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : value >= 35 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{fmtPct(value)}</span>
}

// ── Daily Chart (pure Tailwind bars) ─────────────────────────────────────────

function DailyChart({ data }: { data: DailyCogsRow[] }) {
  const maxValue = Math.max(...data.map(d => d.total_revenue), 1)
  const fmtCompact = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}rb` : String(n)

  if (data.length === 0) return <div className="text-center py-8 text-gray-400 dark:text-gray-500">Tidak ada data</div>

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => Math.round(maxValue * p))

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[600px]">
        {/* Y-axis */}
        <div className="flex flex-col-reverse justify-between h-52 pr-2 text-[10px] text-gray-400 dark:text-gray-500 text-right w-14 shrink-0">
          {yTicks.map((v, i) => <span key={i}>{fmtCompact(v)}</span>)}
        </div>
        {/* Bars */}
        <div className="flex-1 flex items-end gap-1 h-52">
          {data.map(d => {
            const revPct = (d.total_revenue / maxValue) * 100
            const cogsPct = d.total_revenue > 0 ? (d.total_cogs / d.total_revenue) * revPct : 0
            return (
              <div key={d.sales_date} className="flex-1 flex flex-col items-center group">
                {/* Bars wrapper - from bottom */}
                <div className="w-full flex items-end justify-center" style={{ height: '208px' }}>
                  <div className="relative w-[70%]" style={{ height: `${revPct}%` }}>
                    {/* Revenue bar */}
                    <div className="absolute inset-0 bg-blue-100 dark:bg-blue-800/40 border border-blue-300 dark:border-blue-600 rounded-t" />
                    {/* COGS bar inside */}
                    {cogsPct > 0 && (
                      <div className="absolute bottom-0 left-[20%] right-[20%] bg-amber-400 dark:bg-amber-500 rounded-t" style={{ height: `${(d.total_cogs / d.total_revenue) * 100}%`, minHeight: '3px' }} />
                    )}
                  </div>
                </div>
                {/* X label */}
                <span className="text-[9px] text-gray-500 dark:text-gray-400 mt-1">{fmtDate(d.sales_date)}</span>
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg p-2 text-xs z-20 min-w-40">
                  <div className="font-semibold mb-1">{fmtDate(d.sales_date)}</div>
                  <div className="text-blue-600 dark:text-blue-400">Revenue: {fmt(d.total_revenue)}</div>
                  <div className="text-amber-600 dark:text-amber-400">COGS: {fmt(d.total_cogs)}</div>
                  <div className="text-green-600 dark:text-green-400">Gross Profit: {fmt(d.total_revenue - d.total_cogs)}</div>
                  <div className="text-gray-500">COGS%: {fmtPct(d.cogs_percentage)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 ml-14 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded-sm" /> Revenue</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-400 rounded-sm" /> COGS</span>
      </div>
    </div>
  )
}

// ── Hierarchy Table ──────────────────────────────────────────────────────────

function HierarchyTable({ categories, groups, menus }: {
  categories: CategoryBreakdownRow[]
  groups: GroupBreakdownRow[]
  menus: MenuBreakdownRow[]
}) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const groupsByCat = useMemo(() => {
    const map = new Map<string, GroupBreakdownRow[]>()
    for (const g of groups) {
      const k = g.category_code ?? '__null__'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(g)
    }
    return map
  }, [groups])

  const menusByGroup = useMemo(() => {
    const map = new Map<string, MenuBreakdownRow[]>()
    for (const m of menus) {
      const k = `${m.group_id ?? '__null__'}:${m.category_code ?? '__null__'}`
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(m)
    }
    return map
  }, [menus])

  const toggleCat = (code: string | null) => {
    const k = code ?? '__null__'
    setExpandedCats(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  const toggleGroup = (catCode: string | null, groupId: string | null) => {
    const k = `${groupId ?? '__null__'}:${catCode ?? '__null__'}`
    setExpandedGroups(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Nama</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Qty</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">COGS</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">COGS %</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Menu</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {categories.map(cat => {
            const catKey = cat.category_code ?? '__null__'
            const isCatOpen = expandedCats.has(catKey)
            const catGroups = groupsByCat.get(catKey) ?? []

            return (
              <React.Fragment key={catKey}>
                <tr onClick={() => toggleCat(cat.category_code)} className="cursor-pointer bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {isCatOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {cat.category_name ?? 'Tanpa Kategori'}
                    {cat.category_code && <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">{cat.category_code}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{cat.qty_sold.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{fmt(cat.total_revenue)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{fmt(cat.total_cogs)}</td>
                  <td className="px-4 py-3 text-center"><PctBadge value={cat.cogs_percentage} /></td>
                  <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">{cat.menu_count}</td>
                </tr>

                {isCatOpen && catGroups.map(grp => {
                  const grpKey = `${grp.group_id ?? '__null__'}:${grp.category_code ?? '__null__'}`
                  const isGrpOpen = expandedGroups.has(grpKey)
                  const groupMenus = menusByGroup.get(grpKey) ?? []

                  return (
                    <React.Fragment key={grpKey}>
                      <tr onClick={() => toggleGroup(grp.category_code, grp.group_id)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-2.5 pl-10 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          {isGrpOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {grp.group_name ?? <span className="italic text-gray-400">Tanpa group</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">{grp.qty_sold.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">{fmt(grp.total_revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-800 dark:text-gray-200">{fmt(grp.total_cogs)}</td>
                        <td className="px-4 py-2.5 text-center"><PctBadge value={grp.cogs_percentage} /></td>
                        <td className="px-4 py-2.5 text-center text-gray-500 dark:text-gray-400">{grp.menu_count}</td>
                      </tr>

                      {isGrpOpen && groupMenus.map(menu => (
                        <tr key={`menu:${menu.menu_id}`} className="bg-white dark:bg-gray-900/30">
                          <td className="px-4 py-2 pl-16 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                            {menu.menu_name}
                            {menu.has_recipe && <span className="text-[9px] px-1 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">resep</span>}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{menu.qty_sold.toLocaleString('id-ID')}</td>
                          <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{fmt(menu.revenue)}</td>
                          <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{fmt(menu.total_cogs)}</td>
                          <td className="px-4 py-2 text-center"><PctBadge value={menu.cogs_percentage} /></td>
                          <td className="px-4 py-2 text-center text-xs text-gray-400">{fmt(menu.estimated_cost)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CogsBreakdownPage() {
  const { branches } = useBranchContextStore()

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const [periodStart, setPeriodStart] = useState(firstOfMonth)
  const [periodEnd, setPeriodEnd] = useState(todayStr)
  const [branchId, setBranchId] = useState<string>('')

  const { data, isLoading, error } = useCogsBreakdown({ periodStart, periodEnd, branchId: branchId || undefined })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          COGS Breakdown
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Analisis HPP per hari, kategori, group, dan menu</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Dari</label>
          <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sampai</label>
          <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cabang</label>
          <select value={branchId} onChange={e => setBranchId(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
          </select>
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && <div className="text-center py-12 text-gray-500 dark:text-gray-400">Memuat data...</div>}
      {error && <div className="text-center py-8 text-red-600 dark:text-red-400">Gagal memuat: {(error as Error).message}</div>}

      {data && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Revenue</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{fmt(data.summary.total_revenue)}</p>
              <p className="text-xs text-gray-400 mt-1">penjualan menu</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total COGS</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt(data.summary.total_cogs)}</p>
              <p className="text-xs text-gray-400 mt-1">harga pokok penjualan</p>
            </div>
            <div className={`border rounded-xl p-4 ${data.summary.cogs_percentage >= 50 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : data.summary.cogs_percentage >= 35 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">COGS %</p>
              <p className="text-xl font-bold mt-1">{fmtPct(data.summary.cogs_percentage)}</p>
              <p className="text-xs text-gray-400 mt-1">terhadap revenue</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1"><Calendar size={12} /> Rata-rata/hari</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt(data.summary.avg_daily_cogs)}</p>
              <p className="text-xs text-gray-400 mt-1">{data.summary.days_count} hari</p>
            </div>
            {data.summary.peak_day && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1"><TrendingUp size={12} /> Hari Tertinggi</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt(data.summary.peak_day.total_cogs)}</p>
                <p className="text-xs text-gray-400 mt-1">{fmtDate(data.summary.peak_day.sales_date)}</p>
              </div>
            )}
          </div>

          {/* Daily Chart */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-gray-400" /> Tren COGS Harian
            </h3>
            <DailyChart data={data.daily} />
          </div>

          {/* Hierarchy Table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Layers size={16} className="text-gray-400" /> Drill-down: Kategori → Group → Menu
              <span className="text-xs font-normal text-gray-400">Klik untuk expand</span>
            </h3>
            <HierarchyTable categories={data.categories} groups={data.groups} menus={data.menus} />
          </div>
        </>
      )}
    </div>
  )
}
