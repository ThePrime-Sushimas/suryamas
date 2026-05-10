import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Download, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  useTheoreticalConsumption, useVariance, useCoverage,
  useMenuProfitability, useCostTrend, useWasteSummary,
} from '../api/theoretical-consumption.api'
import { useActiveBranches } from '../api/food-production.api'
import { escapeCsv } from '@/utils/csv.utils'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(Math.round(n))
const fmtQty = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const fmtPct = (n: number) => `${n.toFixed(1)}%`

function getDefaultPeriod() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

type Tab = 'theoretical' | 'variance' | 'coverage' | 'profitability' | 'trend' | 'waste'

const TAB_LABELS: Record<Tab, string> = {
  theoretical: 'Theoretical',
  variance: 'Variance',
  coverage: 'Coverage',
  profitability: 'Profitabilitas',
  trend: 'Trend HPP',
  waste: 'Waste',
}

const SEVERITY_STYLES = {
  normal: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
} as const

const PRIORITY_LABELS = {
  high: { label: '🔴 Segera', cls: 'text-red-600' },
  medium: { label: '🟡 Perhatian', cls: 'text-amber-600' },
  low: { label: '🟢 Tunda', cls: 'text-emerald-600' },
} as const

const TIER_STYLES = {
  A: { label: 'A', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  B: { label: 'B', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  C: { label: 'C', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
} as const

function exportCsvFile(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function TheoreticalConsumptionPage() {
  const defaults = useMemo(getDefaultPeriod, [])
  const [periodStart, setPeriodStart] = useState(defaults.start)
  const [periodEnd, setPeriodEnd] = useState(defaults.end)
  const [branchId, setBranchId] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('theoretical')

  const branches = useActiveBranches()
  const params = useMemo(() => ({
    period_start: periodStart,
    period_end: periodEnd,
    ...(branchId ? { branch_id: branchId } : {}),
  }), [periodStart, periodEnd, branchId])

  const theoretical = useTheoreticalConsumption(params)
  const variance = useVariance(params)
  const coverage = useCoverage(params)
  const profitability = useMenuProfitability(params)
  const costTrend = useCostTrend(params)
  const waste = useWasteSummary(params)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-purple-600 rounded-xl"><FlaskConical className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Analisa Konsumsi & HPP</h1>
          <p className="text-xs text-gray-400">Theoretical, variance, profitabilitas menu, trend, dan waste</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Dari</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
              className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sampai</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
              className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cabang</label>
            <select value={branchId} onChange={e => setBranchId(e.target.value)}
              className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option value="">Semua Cabang</option>
              {(branches.data || []).map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'text-purple-600 border-purple-600' : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900'}`}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'theoretical' && <TheoreticalTab data={theoretical.data} isLoading={theoretical.isLoading} params={params} />}
      {activeTab === 'variance' && <VarianceTab data={variance.data} isLoading={variance.isLoading} params={params} coveragePct={coverage.data?.coverage_pct} />}
      {activeTab === 'coverage' && <CoverageTab data={coverage.data} isLoading={coverage.isLoading} params={params} />}
      {activeTab === 'profitability' && <ProfitabilityTab data={profitability.data} isLoading={profitability.isLoading} params={params} />}
      {activeTab === 'trend' && <TrendTab data={costTrend.data} isLoading={costTrend.isLoading} />}
      {activeTab === 'waste' && <WasteTab data={waste.data} isLoading={waste.isLoading} params={params} />}
    </div>
  )
}

// ── Theoretical Tab ──
function TheoreticalTab({ data, isLoading, params }: { data: ReturnType<typeof useTheoreticalConsumption>['data']; isLoading: boolean; params: { period_start: string; period_end: string } }) {
  if (isLoading) return <TableSkeleton cols={5} />
  if (!data || data.items.length === 0) return <EmptyState message="Tidak ada menu dengan resep yang terjual di periode ini." />

  const handleExport = () => exportCsvFile(
    `theoretical-${params.period_start}-${params.period_end}.csv`,
    ['Bahan', 'Kode', 'UOM', 'Qty', 'Est. Cost'],
    data.items.map(i => [i.product_name, i.product_code, i.uom, fmtQty(i.theoretical_qty), fmt(i.theoretical_cost)])
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm text-amber-700 dark:text-amber-400">
          Coverage: {data.coverage.withRecipe}/{data.coverage.total} menu punya resep ({data.coverage.pct}%).
        </span>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bahan</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">UOM</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {data.items.map(item => (
                <tr key={item.product_id}>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">{item.product_name}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs font-mono">{item.product_code}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtQty(item.theoretical_qty)}</td>
                  <td className="px-3 py-2 text-gray-500">{item.uom}</td>
                  <td className="px-3 py-2 text-right font-mono">Rp {fmt(item.theoretical_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ExportButton onClick={handleExport} />
    </div>
  )
}

// ── Variance Tab ──
function VarianceTab({ data, isLoading, params, coveragePct }: { data: ReturnType<typeof useVariance>['data']; isLoading: boolean; params: { period_start: string; period_end: string }; coveragePct?: number }) {
  if (isLoading) return <TableSkeleton cols={6} />
  if (!data || !data.hasActualData) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
        <p className="text-3xl mb-3">📊</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Data actual belum tersedia.</p>
        <p className="text-sm text-gray-500 mb-4">Variance akan tampil setelah Production Order untuk periode ini di-complete.</p>
        <Link to="/food-production/production" className="text-sm text-purple-600 hover:text-purple-800 underline">→ Buat Production Order</Link>
      </div>
    )
  }

  const handleExport = () => exportCsvFile(
    `variance-${params.period_start}-${params.period_end}.csv`,
    ['Bahan', 'Kode', 'UOM', 'Theoretical', 'Actual', 'Variance', '%'],
    data.items.map(i => [i.product_name, i.product_code, i.uom, fmtQty(i.theoretical_qty), fmtQty(i.actual_qty), fmtQty(i.variance_qty), i.variance_pct != null ? `${i.variance_pct}%` : '-'])
  )

  return (
    <div className="space-y-3">
      {coveragePct != null && coveragePct < 50 && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-400">Coverage resep masih rendah ({coveragePct}%) — variance mungkin tidak representatif.</span>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bahan</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Theoretical</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">UOM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {data.items.map(item => (
                <tr key={item.product_id}>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">{item.product_name}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtQty(item.theoretical_qty)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtQty(item.actual_qty)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-medium ${SEVERITY_STYLES[item.severity]}`}>
                    {item.variance_qty > 0 ? '+' : ''}{fmtQty(item.variance_qty)}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${SEVERITY_STYLES[item.severity]}`}>
                    {item.variance_pct != null ? (
                      <>{item.variance_pct > 0 ? '+' : ''}{item.variance_pct}%{item.severity === 'normal' ? ' ✓' : item.severity === 'warning' ? ' ⚠️' : ' 🔴'}</>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{item.uom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ExportButton onClick={handleExport} />
    </div>
  )
}

// ── Coverage Tab ──
function CoverageTab({ data, isLoading, params }: { data: ReturnType<typeof useCoverage>['data']; isLoading: boolean; params: { period_start: string; period_end: string } }) {
  if (isLoading) return <TableSkeleton cols={4} />
  if (!data || data.items.length === 0) return <EmptyState message="Semua menu yang terjual sudah memiliki resep. ✅" />

  const handleExport = () => exportCsvFile(
    `coverage-${params.period_start}-${params.period_end}.csv`,
    ['Menu', 'Kode', 'Terjual', 'Hari', 'Prioritas'],
    data.items.map(i => [i.menu_name, i.menu_code, String(i.total_qty_sold), String(i.days_sold), i.priority])
  )

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          📊 Coverage: {data.menus_with_recipe}/{data.total_menus_sold} menu ({data.coverage_pct}%)
        </p>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.max(data.coverage_pct, 2)}%` }} />
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Menu</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Terjual</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Hari</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prioritas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {data.items.map(item => (
                <tr key={item.pos_menu_id}>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">{item.menu_name}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(item.total_qty_sold)}</td>
                  <td className="px-3 py-2 text-right font-mono">{item.days_sold}</td>
                  <td className={`px-3 py-2 text-sm ${PRIORITY_LABELS[item.priority].cls}`}>{PRIORITY_LABELS[item.priority].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ExportButton onClick={handleExport} />
    </div>
  )
}

// ── Profitability Tab ──
function ProfitabilityTab({ data, isLoading, params }: { data: ReturnType<typeof useMenuProfitability>['data']; isLoading: boolean; params: { period_start: string; period_end: string } }) {
  if (isLoading) return <TableSkeleton cols={7} />
  if (!data || data.length === 0) return <EmptyState message="Tidak ada data profitabilitas. Pastikan menu sudah punya resep dan ada penjualan." />

  const tierCounts = { A: data.filter(d => d.tier === 'A').length, B: data.filter(d => d.tier === 'B').length, C: data.filter(d => d.tier === 'C').length }
  const totalMargin = data.reduce((s, d) => s + d.margin, 0)
  const totalRevenue = data.reduce((s, d) => s + d.total_revenue, 0)
  const avgCostPct = totalRevenue > 0 ? (data.reduce((s, d) => s + d.total_cogs, 0) / totalRevenue * 100) : 0

  const handleExport = () => exportCsvFile(
    `profitability-${params.period_start}-${params.period_end}.csv`,
    ['Menu', 'Kategori', 'Harga Jual', 'HPP', 'Cost%', 'Qty', 'Revenue', 'COGS', 'Margin', 'Tier'],
    data.map(i => [i.menu_name, i.category_name || '-', fmt(i.selling_price), fmt(i.estimated_cost), fmtPct(i.cost_pct), String(i.qty_sold), fmt(i.total_revenue), fmt(i.total_cogs), fmt(i.margin), i.tier])
  )

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Avg Cost %" value={fmtPct(avgCostPct)} color={avgCostPct > 40 ? 'red' : avgCostPct > 30 ? 'amber' : 'emerald'} />
        <SummaryCard label="Total Margin" value={`Rp ${fmt(totalMargin)}`} color="emerald" />
        <SummaryCard label="Tier A (≤30%)" value={String(tierCounts.A)} color="emerald" />
        <SummaryCard label="Tier C (>45%)" value={String(tierCounts.C)} color="red" />
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Menu</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cost%</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margin</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {data.map(item => (
                <tr key={item.menu_id || item.menu_name}>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">{item.menu_name}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{item.category_name || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${item.cost_pct > 45 ? 'bg-red-100 text-red-700' : item.cost_pct > 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {fmtPct(item.cost_pct)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(item.qty_sold)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(item.total_revenue)}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-emerald-600">{fmt(item.margin)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${TIER_STYLES[item.tier].cls}`}>{item.tier}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ExportButton onClick={handleExport} />
    </div>
  )
}

// ── Trend Tab ──
function TrendTab({ data, isLoading }: { data: ReturnType<typeof useCostTrend>['data']; isLoading: boolean }) {
  if (isLoading) return <TableSkeleton cols={4} />
  if (!data || data.length === 0) return <EmptyState message="Belum ada data trend. Data akan muncul setelah ada penjualan beberapa bulan." />

  const maxRevenue = Math.max(...data.map(d => d.total_revenue), 1)

  return (
    <div className="space-y-3">
      {/* Visual bar chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-500" /> HPP % per Bulan ({data.length} periode)
        </p>
        <div className="space-y-2">
          {data.map(item => (
            <div key={item.period} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 shrink-0 font-mono">{item.period}</span>
              <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-blue-200 dark:bg-blue-900/50 rounded-full"
                  style={{ width: `${(item.total_revenue / maxRevenue) * 100}%` }}
                />
                <div
                  className={`h-full absolute top-0 left-0 rounded-full ${item.cost_pct > 40 ? 'bg-red-400' : item.cost_pct > 30 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${(item.total_cogs / maxRevenue) * 100}%` }}
                />
              </div>
              <span className={`text-xs font-bold w-12 text-right ${item.cost_pct > 40 ? 'text-red-600' : item.cost_pct > 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {fmtPct(item.cost_pct)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-200 rounded" /> Revenue</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-400 rounded" /> COGS (≤30%)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-amber-400 rounded" /> COGS (30-40%)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-400 rounded" /> COGS (&gt;40%)</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Periode</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">COGS</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cost %</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Menu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {data.map((item, idx) => {
              const prev = idx > 0 ? data[idx - 1] : null
              const delta = prev ? item.cost_pct - prev.cost_pct : 0
              return (
                <tr key={item.period}>
                  <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">{item.period}</td>
                  <td className="px-3 py-2 text-right font-mono">Rp {fmt(item.total_revenue)}</td>
                  <td className="px-3 py-2 text-right font-mono">Rp {fmt(item.total_cogs)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${item.cost_pct > 40 ? 'bg-red-100 text-red-700' : item.cost_pct > 30 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {fmtPct(item.cost_pct)}
                    </span>
                    {delta !== 0 && (
                      <span className={`ml-1 text-[10px] ${delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {delta > 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">{item.menu_count}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Waste Tab ──
function WasteTab({ data, isLoading, params }: { data: ReturnType<typeof useWasteSummary>['data']; isLoading: boolean; params: { period_start: string; period_end: string } }) {
  if (isLoading) return <TableSkeleton cols={5} />
  if (!data || data.items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
        <p className="text-3xl mb-3">♻️</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tidak ada data waste di periode ini.</p>
        <p className="text-sm text-gray-500 mb-4">Waste tercatat saat Production Order di-complete.</p>
        <Link to="/food-production/production" className="text-sm text-purple-600 hover:text-purple-800 underline">→ Lihat Production Orders</Link>
      </div>
    )
  }

  const handleExport = () => exportCsvFile(
    `waste-${params.period_start}-${params.period_end}.csv`,
    ['Bahan', 'Kode', 'UOM', 'Total Pakai', 'Waste', 'Waste%', 'Waste Cost'],
    data.items.map(i => [i.product_name, i.product_code, i.uom, fmtQty(i.total_used), fmtQty(i.total_waste), fmtPct(i.waste_pct), fmt(i.waste_cost)])
  )

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <SummaryCard label="Total Waste Cost" value={`Rp ${fmt(data.totals.total_waste_cost)}`} color="red" />
        <SummaryCard label="Overall Waste %" value={fmtPct(data.totals.overall_waste_pct)} color={data.totals.overall_waste_pct > 5 ? 'red' : data.totals.overall_waste_pct > 2 ? 'amber' : 'emerald'} />
        <SummaryCard label="Bahan dengan Waste" value={String(data.items.length)} color="gray" />
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bahan</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Pakai</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Waste</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Waste %</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Waste Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {data.items.map(item => (
                <tr key={item.product_id}>
                  <td className="px-3 py-2">
                    <p className="text-gray-900 dark:text-white">{item.product_name}</p>
                    <p className="text-[10px] text-gray-400">{item.product_code} · {item.uom}</p>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtQty(item.total_used)}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600">{fmtQty(item.total_waste)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${item.waste_pct > 10 ? 'bg-red-100 text-red-700' : item.waste_pct > 5 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {fmtPct(item.waste_pct)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-red-600">Rp {fmt(item.waste_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ExportButton onClick={handleExport} />
    </div>
  )
}

// ── Shared Components ──
function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  )
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
        <Download className="w-4 h-4" /> Export CSV
      </button>
    </div>
  )
}

const CARD_COLORS = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  gray: 'text-gray-700 dark:text-gray-300',
} as const

function SummaryCard({ label, value, color }: { label: string; value: string; color: keyof typeof CARD_COLORS }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${CARD_COLORS[color]}`}>{value}</p>
    </div>
  )
}
