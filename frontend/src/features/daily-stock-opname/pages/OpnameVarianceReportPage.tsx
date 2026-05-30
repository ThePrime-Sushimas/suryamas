import { useState, useMemo } from 'react'
import { BarChart3, Download, Loader2, X, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { useVarianceReport, useExportVarianceReportCsv } from '../api/dailyStockOpname'
import { useBranches } from '@/features/branches/api/branches.api'
import type { VarianceReportFilter, VarianceReportItem } from '../types'

// ─── FORMATTERS ──────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

const fmtNumber = (v: number, decimals = 2) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)

const fmtPct = (v: number) => `${fmtNumber(v)}%`

// ─── TYPES ───────────────────────────────────────────────────────────────────

type SortField = 'product_name' | 'total_variance_qty' | 'total_variance_cost' | 'avg_variance_pct' | 'session_count' | 'flagged_count'
type SortDir = 'asc' | 'desc'
type GroupBy = 'day' | 'week' | 'month'
type RiskCategory = 'HIGH' | 'MEDIUM' | 'LOW' | ''

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'day', label: 'Harian' },
  { value: 'week', label: 'Mingguan' },
  { value: 'month', label: 'Bulanan' },
]

const RISK_OPTIONS: { value: RiskCategory; label: string }[] = [
  { value: '', label: 'Semua Risiko' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function OpnameVarianceReportPage() {
  // Filter state
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [branchId, setBranchId] = useState('')
  const [riskCategory, setRiskCategory] = useState<RiskCategory>('')
  const [groupBy, setGroupBy] = useState<GroupBy>('day')

  // Sort state
  const [sortField, setSortField] = useState<SortField>('total_variance_cost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Branches
  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  // Build filter params
  const filterParams: VarianceReportFilter = useMemo(() => ({
    date_from: dateFrom,
    date_to: dateTo,
    ...(branchId ? { branch_id: branchId } : {}),
    ...(riskCategory ? { risk_category: riskCategory } : {}),
    group_by: groupBy,
  }), [dateFrom, dateTo, branchId, riskCategory, groupBy])

  // Query
  const { data: reportData, isLoading } = useVarianceReport(filterParams)
  const items = reportData ?? []

  // Export
  const exportCsv = useExportVarianceReportCsv()

  // Sort items
  const sortedItems = useMemo(() => {
    if (!items.length) return items
    return [...items].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'product_name':
          cmp = a.product_name.localeCompare(b.product_name)
          break
        case 'total_variance_qty':
          cmp = a.total_variance_qty - b.total_variance_qty
          break
        case 'total_variance_cost':
          cmp = a.total_variance_cost - b.total_variance_cost
          break
        case 'avg_variance_pct':
          cmp = a.avg_variance_pct - b.avg_variance_pct
          break
        case 'session_count':
          cmp = a.session_count - b.session_count
          break
        case 'flagged_count':
          cmp = a.flagged_count - b.flagged_count
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const handleExport = () => {
    if (!dateFrom || !dateTo) return
    exportCsv.mutate(filterParams)
  }

  const handleReset = () => {
    setDateFrom('')
    setDateTo('')
    setBranchId('')
    setRiskCategory('')
    setGroupBy('day')
  }

  const hasActiveFilters = branchId || riskCategory || dateFrom || dateTo
  const canQuery = !!dateFrom && !!dateTo

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
              <BarChart3 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Variance Report
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Analisis variance per produk
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={exportCsv.isPending || !canQuery}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {exportCsv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                <option value="">Semua Branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branch_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Risiko</label>
              <select
                value={riskCategory}
                onChange={(e) => setRiskCategory(e.target.value as RiskCategory)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                {RISK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Group By</label>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                {GROUP_BY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGroupBy(opt.value)}
                    className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                      groupBy === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              {hasActiveFilters && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 pb-2"
                >
                  <X className="h-3 w-3" /> Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
          {!canQuery ? (
            <div className="p-16 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Pilih rentang tanggal untuk melihat laporan variance
              </p>
            </div>
          ) : isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="p-16 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Tidak ada data variance untuk filter yang dipilih
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700/60 sticky top-0">
                  <tr>
                    <SortableHeader
                      label="Produk"
                      field="product_name"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                      align="left"
                    />
                    <SortableHeader
                      label="Total Variance Qty"
                      field="total_variance_qty"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Total Variance Cost"
                      field="total_variance_cost"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Avg Variance %"
                      field="avg_variance_pct"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Sessions"
                      field="session_count"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                      align="center"
                    />
                    <SortableHeader
                      label="Flagged"
                      field="flagged_count"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                      align="center"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {sortedItems.map((item) => (
                    <VarianceRow key={item.product_id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SORTABLE HEADER ─────────────────────────────────────────────────────────

function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = 'left',
}: {
  label: string
  field: SortField
  currentField: SortField
  currentDir: SortDir
  onSort: (field: SortField) => void
  align?: 'left' | 'right' | 'center'
}) {
  const isActive = currentField === field
  const alignClass = align === 'right' ? 'text-right justify-end' : align === 'center' ? 'text-center justify-center' : 'text-left'

  return (
    <th className={`px-6 py-4 ${alignClass}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        {label}
        {isActive ? (
          currentDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  )
}

// ─── TABLE ROW ───────────────────────────────────────────────────────────────

function VarianceRow({ item }: { item: VarianceReportItem }) {
  const isNegativeVariance = item.total_variance_cost < 0
  const varianceCostColor = isNegativeVariance
    ? 'text-red-600 dark:text-red-400'
    : item.total_variance_cost > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-gray-600 dark:text-gray-400'

  const riskBadge = item.risk_category === 'HIGH'
    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    : item.risk_category === 'MEDIUM'
      ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      : 'bg-gray-50 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400'

  return (
    <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-gray-900 dark:text-white font-medium">{item.product_name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.product_code} · {item.uom}</p>
          </div>
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${riskBadge}`}>
            {item.risk_category}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-right text-gray-900 dark:text-white font-mono">
        {fmtNumber(item.total_variance_qty)}
      </td>
      <td className={`px-6 py-4 text-right font-mono font-medium ${varianceCostColor}`}>
        {fmtCurrency(item.total_variance_cost)}
      </td>
      <td className="px-6 py-4 text-right text-gray-700 dark:text-gray-300 font-mono">
        {fmtPct(item.avg_variance_pct)}
      </td>
      <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
        {item.session_count}
      </td>
      <td className="px-6 py-4 text-center">
        {item.flagged_count > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {item.flagged_count}
          </span>
        ) : (
          <span className="text-gray-400">0</span>
        )}
      </td>
    </tr>
  )
}
