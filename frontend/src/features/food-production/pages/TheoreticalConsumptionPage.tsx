import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Download } from 'lucide-react'
import { useTheoreticalConsumption, useVariance, useCoverage } from '../api/theoretical-consumption.api'
import { useActiveBranches } from '../api/food-production.api'
import { escapeCsv } from '@/utils/csv.utils'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(Math.round(n))
const fmtQty = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

function getDefaultPeriod() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

type Tab = 'theoretical' | 'variance' | 'coverage'

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

  const exportCsv = (filename: string, headers: string[], rows: string[][]) => {
    const csv = [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportTheoretical = () => {
    if (!theoretical.data?.items.length) return
    exportCsv(
      `theoretical-consumption-${periodStart}-${periodEnd}.csv`,
      ['Bahan', 'Kode', 'UOM', 'Qty', 'Est. Cost'],
      theoretical.data.items.map(i => [i.product_name, i.product_code, i.uom, fmtQty(i.theoretical_qty), fmt(i.theoretical_cost)])
    )
  }

  const handleExportVariance = () => {
    if (!variance.data?.items.length) return
    exportCsv(
      `variance-${periodStart}-${periodEnd}.csv`,
      ['Bahan', 'Kode', 'UOM', 'Theoretical', 'Actual', 'Variance', '%'],
      variance.data.items.map(i => [i.product_name, i.product_code, i.uom, fmtQty(i.theoretical_qty), fmtQty(i.actual_qty), fmtQty(i.variance_qty), i.variance_pct != null ? `${i.variance_pct}%` : '-'])
    )
  }

  const handleExportCoverage = () => {
    if (!coverage.data?.items.length) return
    exportCsv(
      `coverage-${periodStart}-${periodEnd}.csv`,
      ['Menu', 'Kode', 'Terjual', 'Hari', 'Prioritas'],
      coverage.data.items.map(i => [i.menu_name, i.menu_code, String(i.total_qty_sold), String(i.days_sold), i.priority])
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-purple-600 rounded-xl"><FlaskConical className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Analisa Konsumsi Bahan</h1>
          <p className="text-xs text-gray-400">Theoretical consumption, variance, dan recipe coverage</p>
        </div>
      </div>

      {/* Filters */}
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {(['theoretical', 'variance', 'coverage'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'text-purple-600 border-purple-600' : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900'}`}>
            {tab === 'theoretical' ? 'Theoretical' : tab === 'variance' ? 'Variance' : 'Coverage'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'theoretical' && (
        <TheoreticalTab data={theoretical.data} isLoading={theoretical.isLoading} onExport={handleExportTheoretical} />
      )}
      {activeTab === 'variance' && (
        <VarianceTab data={variance.data} isLoading={variance.isLoading} onExport={handleExportVariance} coveragePct={coverage.data?.coverage_pct} />
      )}
      {activeTab === 'coverage' && (
        <CoverageTab data={coverage.data} isLoading={coverage.isLoading} onExport={handleExportCoverage} />
      )}
    </div>
  )
}

// ── Theoretical Tab ──
function TheoreticalTab({ data, isLoading, onExport }: { data: ReturnType<typeof useTheoreticalConsumption>['data']; isLoading: boolean; onExport: () => void }) {
  if (isLoading) return <TableSkeleton cols={5} />

  if (!data || data.items.length === 0) {
    return <EmptyState message="Tidak ada menu dengan resep yang terjual di periode ini." />
  }

  return (
    <div className="space-y-3">
      {/* Coverage disclaimer */}
      <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
        <span className="text-sm text-amber-700 dark:text-amber-400">
          ⚠️ Coverage: {data.coverage.withRecipe}/{data.coverage.total} menu punya resep ({data.coverage.pct}%). Hasil hanya mencerminkan menu yang sudah memiliki resep.
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

      <div className="flex justify-end">
        <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
    </div>
  )
}

// ── Variance Tab ──
function VarianceTab({ data, isLoading, onExport, coveragePct }: { data: ReturnType<typeof useVariance>['data']; isLoading: boolean; onExport: () => void; coveragePct?: number }) {
  if (isLoading) return <TableSkeleton cols={6} />

  if (!data || !data.hasActualData) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
        <p className="text-3xl mb-3">📊</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Data actual belum tersedia.</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Variance akan tampil setelah Production Order untuk periode ini di-complete.</p>
        <Link to="/food-production/production" className="text-sm text-purple-600 hover:text-purple-800 underline">
          → Buat Production Order
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {coveragePct != null && coveragePct < 50 && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <span className="text-sm text-amber-700 dark:text-amber-400">
            ⚠️ Coverage resep masih rendah ({coveragePct}%) — variance mungkin tidak representatif.
          </span>
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
                      <span>
                        {item.variance_pct > 0 ? '+' : ''}{item.variance_pct}%
                        {item.severity === 'normal' && ' ✓'}
                        {item.severity === 'warning' && ' ⚠️'}
                        {item.severity === 'critical' && ' 🔴'}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{item.uom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
    </div>
  )
}

// ── Coverage Tab ──
function CoverageTab({ data, isLoading, onExport }: { data: ReturnType<typeof useCoverage>['data']; isLoading: boolean; onExport: () => void }) {
  if (isLoading) return <TableSkeleton cols={4} />

  if (!data || data.items.length === 0) {
    return <EmptyState message="Semua menu yang terjual sudah memiliki resep. ✅" />
  }

  const barWidth = Math.max(data.coverage_pct, 2)

  return (
    <div className="space-y-3">
      {/* Coverage bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          📊 Coverage: {data.menus_with_recipe}/{data.total_menus_sold} menu ({data.coverage_pct}%)
        </p>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">Menu tanpa resep yang terjual di periode ini:</p>

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
                  <td className={`px-3 py-2 text-sm ${PRIORITY_LABELS[item.priority].cls}`}>
                    {PRIORITY_LABELS[item.priority].label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
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
