import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useBranches } from '@/features/branches/api/branches.api'
import { useCategories } from '@/features/categories/api/categories.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import {
  useWasteCompare,
  useWasteReport,
  useWasteReportByBranch,
  type WasteBranchGroup,
  type WasteCompareParams,
  type WasteCompareResponse,
  type WasteRecord,
  type WasteReportParams,
  type WasteSource,
  type MonthlyOpnameSelisih,
} from '../api/wasteReport.api'
import { groupWasteByItem } from '../utils/groupWasteByItem'
import { exportWasteReportExcel } from '../utils/wasteReportExport'
import {
  aggregateTrendDaily,
  aggregateTrendWeekly,
  filterPeriodDays,
  trendPointsToChartRows,
  type TrendPoint,
} from '../utils/aggregateTrend'

const fmt = (n: number | null | undefined) =>
  n == null
    ? '-'
    : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

const fmtRp = (n: number | null | undefined) =>
  n == null
    ? '-'
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const SOURCE_LABELS: Record<WasteSource, string> = {
  GOODS_PROCESSING: 'Bongkar Barang',
  STOCK_ADJUSTMENT: 'Penyesuaian Stok',
  PRODUCTION_ORDER: 'Produksi',
  DAILY_OPNAME: 'Opname Harian',
}

const SOURCE_COLORS: Record<WasteSource, string> = {
  GOODS_PROCESSING: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  STOCK_ADJUSTMENT: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  PRODUCTION_ORDER: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  DAILY_OPNAME: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
}

const SOURCE_CHART_COLORS: Record<WasteSource, string> = {
  GOODS_PROCESSING: '#7c3aed',
  STOCK_ADJUSTMENT: '#e11d48',
  PRODUCTION_ORDER: '#d97706',
  DAILY_OPNAME: '#0284c7',
}

const DETAIL_PAGE_SIZE = 50

type DetailSortColumn = 'date' | 'branch' | 'source' | 'product' | 'qty' | 'value' | 'reason'
type SortDirection = 'asc' | 'desc'
type ByItemSortKey = 'total_cost' | 'total_qty' | 'record_count' | 'item_name'

function recordKey(r: WasteRecord): string {
  if (r.source === 'PRODUCTION_ORDER') {
    return `${r.source}-${String(r.metadata?.material_id ?? r.reference_id)}`
  }
  return `${r.source}-${r.reference_id}`
}

function ProductionOrderStatusBadge({ record }: { record: WasteRecord }) {
  if (record.source !== 'PRODUCTION_ORDER') return null
  if (record.metadata?.is_voided === true) {
    return (
      <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
        dibatalkan
      </span>
    )
  }
  if (record.metadata?.is_provisional === true) {
    return (
      <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        belum final
      </span>
    )
  }
  return null
}

type TabId = 'summary' | 'detail' | 'by-item' | 'by-branch' | 'monthly'

export default function WasteReportPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchId, setBranchId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [source, setSource] = useState<WasteSource | ''>('')
  const [recordSearch, setRecordSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('summary')
  const [applied, setApplied] = useState<WasteReportParams | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareBStart, setCompareBStart] = useState('')
  const [compareBEnd, setCompareBEnd] = useState('')
  const [compareB, setCompareB] = useState<{ start: string; end: string } | null>(null)
  const toast = useToast()

  const { data: branchesData } = useBranches({ limit: 100, filter: { status: 'active' } })
  const branches = branchesData?.data ?? []

  const { data: categoriesData } = useCategories({ limit: 200, is_active: 'true' })
  const categories = categoriesData?.data ?? []

  const params = useMemo<WasteReportParams | null>(() => {
    if (!applied) return null
    return applied
  }, [applied])

  const { data: report, isLoading, isFetching } = useWasteReport(params)

  const byBranchParams = useMemo<WasteReportParams | null>(() => {
    if (!applied || applied.branch_id) return null
    const { branch_id: _, ...rest } = applied
    return rest
  }, [applied])

  const { data: byBranchData, isLoading: byBranchLoading } = useWasteReportByBranch(byBranchParams)

  const compareParams = useMemo<WasteCompareParams | null>(() => {
    if (!applied || !compareB) return null
    return {
      period_a_start: applied.start_date,
      period_a_end: applied.end_date,
      period_b_start: compareB.start,
      period_b_end: compareB.end,
      ...(applied.branch_id ? { branch_id: applied.branch_id } : {}),
      ...(applied.category_id ? { category_id: applied.category_id } : {}),
      ...(applied.source ? { source: applied.source } : {}),
    }
  }, [applied, compareB])

  const { data: compareData, isLoading: compareLoading, isFetching: compareFetching } =
    useWasteCompare(compareParams)

  const byItemGroups = useMemo(
    () => groupWasteByItem(report?.records ?? []),
    [report?.records],
  )

  const branchNameById = useMemo(
    () => new Map(branches.map((b) => [b.id, b.branch_name])),
    [branches],
  )

  const canQuery = !!startDate && !!endDate

  const applyFilters = () => {
    if (!canQuery) return
    setApplied({
      start_date: startDate,
      end_date: endDate,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(source ? { source } : {}),
    })
  }

  const setLast30Days = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const filteredRecords = useMemo(() => {
    const records = report?.records ?? []
    const q = recordSearch.trim().toLowerCase()
    if (!q) return records
    return records.filter(
      (r) =>
        r.item_name?.toLowerCase().includes(q) ||
        r.branch_name?.toLowerCase().includes(q) ||
        r.reference_code?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q) ||
        SOURCE_LABELS[r.source].toLowerCase().includes(q),
    )
  }, [report?.records, recordSearch])

  const isDirty =
    applied != null &&
    (startDate !== applied.start_date ||
      endDate !== applied.end_date ||
      (branchId || undefined) !== applied.branch_id ||
      (categoryId || undefined) !== applied.category_id ||
      (source || undefined) !== applied.source)

  const handleExport = async () => {
    if (!params) return
    setIsExporting(true)
    try {
      await exportWasteReportExcel(params)
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message === 'NO_DATA'
          ? 'Tidak ada data untuk diekspor'
          : parseApiError(err, 'Gagal mengekspor laporan waste')
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }

  const provisionalPoCount = useMemo(
    () =>
      (report?.records ?? []).filter(
        (r) =>
          r.source === 'PRODUCTION_ORDER' &&
          (r.metadata?.is_provisional === true || r.metadata?.is_voided === true),
      ).length,
    [report?.records],
  )

  const tabs: { id: TabId; label: string }[] = [
    { id: 'summary', label: 'Ringkasan' },
    { id: 'detail', label: 'Detail Transaksi' },
    { id: 'by-item', label: 'Per Produk' },
    { id: 'by-branch', label: 'Benchmark Cabang' },
    { id: 'monthly', label: 'Indikasi Kebocoran Bulanan' },
  ]

  const handleCompare = () => {
    if (!compareBStart || !compareBEnd) return
    if (compareBStart > compareBEnd) {
      toast.error('Tanggal mulai periode pembanding harus sebelum atau sama dengan tanggal akhir')
      return
    }
    setCompareB({ start: compareBStart, end: compareBEnd })
  }

  return (
    <div className="min-h-full bg-gray-50/80 dark:bg-gray-900/50">
      <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 shadow-sm">
              <Trash2 className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Laporan Waste
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Agregasi waste terverifikasi dari bongkar barang, penyesuaian, produksi, dan opname harian
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && <Loader2 className="w-5 h-5 animate-spin text-red-500" />}
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || !params}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={!params ? 'Tampilkan data terlebih dahulu sebelum export' : undefined}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? 'Mengekspor...' : 'Export Excel'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm p-5">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Dari tanggal *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Sampai tanggal *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Cabang
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[180px]"
              >
                <option value="">Semua cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branch_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Kategori
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-40"
              >
                <option value="">Semua kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Sumber
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as WasteSource | '')}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[180px]"
              >
                <option value="">Semua sumber</option>
                {(Object.keys(SOURCE_LABELS) as WasteSource[]).map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={setLast30Days}
              className="px-3 py-2.5 text-xs font-medium rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              30 hari terakhir
            </button>
            <button
              type="button"
              onClick={applyFilters}
              disabled={!canQuery}
              className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isDirty
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-sm'
                  : 'bg-red-600 hover:bg-red-700 shadow-sm'
              }`}
            >
              {isDirty ? 'Perbarui' : 'Tampilkan'}
            </button>
          </div>
          {!canQuery && (
            <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
              Pilih rentang tanggal untuk memuat laporan.
            </p>
          )}
        </div>

        {!applied ? (
          <EmptyState message="Atur filter dan klik Tampilkan untuk melihat laporan waste." />
        ) : isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        ) : (
          <>
            {/* Period comparison panel */}
            <ComparePanel
              open={compareOpen}
              onToggle={() => setCompareOpen((v) => !v)}
              periodALabel={`${fmtDate(applied.start_date)} – ${fmtDate(applied.end_date)}`}
              compareBStart={compareBStart}
              compareBEnd={compareBEnd}
              onCompareBStartChange={setCompareBStart}
              onCompareBEndChange={setCompareBEnd}
              onCompare={handleCompare}
              compareData={compareData}
              isLoading={compareLoading || compareFetching}
              hasCompareB={!!compareB}
            />

            {/* Source breakdown */}
            {provisionalPoCount > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  {provisionalPoCount} baris waste produksi dari PO{' '}
                  <strong>belum final</strong> atau <strong>dibatalkan</strong> — tetap
                  dijumlah ke total, lihat badge di tab Detail.
                </p>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Breakdown per Sumber
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(Object.keys(SOURCE_LABELS) as WasteSource[]).map((s) => {
                  const b = report?.summary.breakdown_by_source[s]
                  return (
                    <div
                      key={s}
                      className="rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow"
                    >
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-lg mb-2 ${SOURCE_COLORS[s]}`}
                      >
                        {SOURCE_LABELS[s]}
                      </span>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{fmtRp(b?.cost)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Qty: {fmt(b?.qty)}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm overflow-hidden">
              <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                    {tab.id === 'monthly' && (report?.monthly_selisih.length ?? 0) > 0 && (
                      <span className="ml-1.5 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded-lg">
                        {report?.monthly_selisih.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {activeTab === 'summary' && applied && (
                  <WasteTrendChart
                    records={report?.records ?? []}
                    startDate={applied.start_date}
                    endDate={applied.end_date}
                  />
                )}

                {activeTab === 'detail' && (
                  <DetailTab
                    records={filteredRecords}
                    search={recordSearch}
                    onSearchChange={setRecordSearch}
                    branchNameById={branchNameById}
                  />
                )}

                {activeTab === 'by-item' && <ByItemTab groups={byItemGroups} />}

                {activeTab === 'by-branch' && (
                  <ByBranchTab
                    groups={byBranchData ?? []}
                    isLoading={byBranchLoading}
                    branchFiltered={!!applied?.branch_id}
                  />
                )}

                {activeTab === 'monthly' && (
                  <MonthlyTab rows={report?.monthly_selisih ?? []} branchNameById={branchNameById} />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
      <Trash2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">{message}</p>
    </div>
  )
}

function DetailTab({
  records,
  search,
  onSearchChange,
  branchNameById,
}: {
  records: WasteRecord[]
  search: string
  onSearchChange: (v: string) => void
  branchNameById: Map<string, string>
}) {
  const [sortColumn, setSortColumn] = useState<DetailSortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [records, sortColumn, sortDirection])

  const handleSort = (column: DetailSortColumn) => {
    if (sortColumn !== column) {
      setSortColumn(column)
      setSortDirection('asc')
      return
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc')
      return
    }
    setSortColumn(null)
    setSortDirection('desc')
  }

  const sortedRecords = useMemo(() => {
    const base = [...records]
    if (!sortColumn) {
      return base.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
    const dir = sortDirection === 'asc' ? 1 : -1
    const branchOf = (r: WasteRecord) => r.branch_name ?? branchNameById.get(r.branch_id) ?? ''
    return base.sort((a, b) => {
      switch (sortColumn) {
        case 'date':
          return dir * (new Date(a.date).getTime() - new Date(b.date).getTime())
        case 'branch':
          return dir * branchOf(a).localeCompare(branchOf(b), 'id')
        case 'source':
          return dir * SOURCE_LABELS[a.source].localeCompare(SOURCE_LABELS[b.source], 'id')
        case 'product':
          return dir * (a.item_name ?? a.item_id).localeCompare(b.item_name ?? b.item_id, 'id')
        case 'qty':
          return dir * (a.qty - b.qty)
        case 'value':
          return dir * (a.total_cost - b.total_cost)
        case 'reason':
          return dir * (a.reason ?? '').localeCompare(b.reason ?? '', 'id')
        default:
          return 0
      }
    })
  }, [records, sortColumn, sortDirection, branchNameById])

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / DETAIL_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * DETAIL_PAGE_SIZE
  const pageRecords = sortedRecords.slice(pageStart, pageStart + DETAIL_PAGE_SIZE)

  if (records.length === 0) {
    return <EmptyState message="Tidak ada transaksi waste pada periode ini." />
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari produk, cabang, nomor dokumen, alasan..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <SortableTh label="Tanggal" column="date" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableTh label="Cabang" column="branch" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableTh label="Sumber" column="source" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableTh label="Produk" column="product" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <SortableTh label="Qty" column="qty" active={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              <SortableTh label="Nilai" column="value" active={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              <SortableTh label="Alasan" column="reason" active={sortColumn} direction={sortDirection} onSort={handleSort} />
              <th className="px-4 py-3">Referensi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {pageRecords.map((r) => (
              <tr key={recordKey(r)} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                  {fmtDate(r.date)}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-60">
                  {r.branch_name ?? branchNameById.get(r.branch_id) ?? '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${SOURCE_COLORS[r.source]}`}>
                    {SOURCE_LABELS[r.source]}
                  </span>
                  <ProductionOrderStatusBadge record={r} />
                  {r.metadata?.cost_unavailable === true && (
                    <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">no cost</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                  {r.item_name ?? r.item_id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(r.qty)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtRp(r.total_cost)}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-60">
                  {r.reason ?? '-'}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs truncate">
                  {r.reference_code ?? r.reference_id.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedRecords.length > DETAIL_PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Menampilkan {pageStart + 1}–{Math.min(pageStart + DETAIL_PAGE_SIZE, sortedRecords.length)} dari{' '}
            {sortedRecords.length} transaksi
          </p>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-gray-600 dark:text-gray-300 px-2">
              Halaman {safePage} dari {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableTh({
  label,
  column,
  active,
  direction,
  onSort,
  align = 'left',
}: {
  label: string
  column: DetailSortColumn
  active: DetailSortColumn | null
  direction: SortDirection
  onSort: (c: DetailSortColumn) => void
  align?: 'left' | 'right'
}) {
  const isActive = active === column
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 ${align === 'right' ? 'ml-auto' : ''}`}
      >
        {label}
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
        )}
      </button>
    </th>
  )
}

function ByItemTab({ groups }: { groups: ReturnType<typeof groupWasteByItem> }) {
  const [sortKey, setSortKey] = useState<ByItemSortKey>('total_cost')

  const sortedGroups = useMemo(() => {
    const list = [...groups]
    switch (sortKey) {
      case 'total_qty':
        return list.sort((a, b) => b.total_qty - a.total_qty)
      case 'record_count':
        return list.sort((a, b) => b.record_count - a.record_count)
      case 'item_name':
        return list.sort((a, b) =>
          (a.item_name ?? a.item_id).localeCompare(b.item_name ?? b.item_id, 'id'),
        )
      default:
        return list.sort((a, b) => b.total_cost - a.total_cost)
    }
  }, [groups, sortKey])

  const sortOptions: { key: ByItemSortKey; label: string }[] = [
    { key: 'total_cost', label: 'Total Nilai' },
    { key: 'total_qty', label: 'Total Qty' },
    { key: 'record_count', label: 'Transaksi' },
    { key: 'item_name', label: 'Nama Produk' },
  ]

  if (groups.length === 0) {
    return <EmptyState message="Tidak ada produk dengan waste pada periode ini." />
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900/50">
        {sortOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortKey(opt.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              sortKey === opt.key
                ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {sortedGroups.map((g, i) => (
          <div
            key={g.item_id}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-all"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-sm font-bold text-gray-600 dark:text-gray-300 shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {g.item_name ?? g.item_id}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {g.record_count} transaksi · Qty {fmt(g.total_qty)}
              </p>
            </div>
            <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums shrink-0">
              {fmtRp(g.total_cost)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthlyTab({
  rows,
  branchNameById,
}: {
  rows: MonthlyOpnameSelisih[]
  branchNameById: Map<string, string>
}) {
  if (rows.length === 0) {
    return (
      <EmptyState message="Tidak ada selisih negatif dari opname bulanan pada periode ini." />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Indikasi kebocoran bulanan (belum terverifikasi)
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1">
            Data ini tidak dijumlah ke total waste di atas. Gunakan untuk monitoring selisih opname
            bulanan yang perlu investigasi lebih lanjut.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">Tanggal Opname</th>
              <th className="px-4 py-3">Cabang</th>
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3 text-right">Selisih Qty</th>
              <th className="px-4 py-3 text-right">Selisih Nilai</th>
              <th className="px-4 py-3">Catatan Investigasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((r) => (
              <tr key={r.reference_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
                <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-4 py-3 max-w-[140px] truncate">
                  {r.branch_name ?? branchNameById.get(r.branch_id) ?? '-'}
                </td>
                <td className="px-4 py-3 font-medium">{r.item_name ?? '-'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                  {fmt(r.selisih_qty)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtRp(Math.abs(r.selisih_value))}</td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.investigasi_note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WasteTrendChart({
  records,
  startDate,
  endDate,
}: {
  records: WasteRecord[]
  startDate: string
  endDate: string
}) {
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily')
  const [stacked, setStacked] = useState(true)

  useEffect(() => {
    const days = filterPeriodDays(startDate, endDate)
    setGranularity(days > 60 ? 'weekly' : 'daily')
  }, [startDate, endDate])

  const trendPoints = useMemo(() => {
    return granularity === 'weekly'
      ? aggregateTrendWeekly(records)
      : aggregateTrendDaily(records)
  }, [records, granularity])

  const chartData = useMemo(
    () => trendPointsToChartRows(trendPoints, stacked),
    [trendPoints, stacked],
  )

  if (trendPoints.length === 0) {
    return (
      <EmptyState message="Tidak ada trend waste pada periode ini — tidak ada transaksi dengan nilai waste." />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Trend Nilai Waste</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Agregasi dari {records.length} transaksi · periode {granularity === 'weekly' ? 'mingguan' : 'harian'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-900/50">
            {(['daily', 'weekly'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  granularity === g
                    ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {g === 'daily' ? 'Harian' : 'Mingguan'}
              </button>
            ))}
          </div>
          <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-900/50">
            <button
              type="button"
              onClick={() => setStacked(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                !stacked
                  ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Gabung
            </button>
            <button
              type="button"
              onClick={() => setStacked(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                stacked
                  ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Per Sumber
            </button>
          </div>
        </div>
      </div>

      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="text-gray-500"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => (Number(v) >= 1_000_000 ? `${Number(v) / 1_000_000}jt` : String(v))}
              className="text-gray-500"
            />
            <Tooltip
              content={({ active, payload, label }) => (
                <TrendTooltipContent
                  active={active}
                  payload={payload}
                  point={trendPoints.find(
                    (p) => p.label === (typeof label === 'string' ? label : String(label ?? '')),
                  )}
                  stacked={stacked}
                />
              )}
            />
            {stacked ? (
              <>
                {(Object.keys(SOURCE_LABELS) as WasteSource[]).map((s) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    name={SOURCE_LABELS[s]}
                    stackId="waste"
                    fill={SOURCE_CHART_COLORS[s]}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </>
            ) : (
              <Bar dataKey="total_cost" name="Total Nilai" fill="#dc2626" radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function TrendTooltipContent({
  active,
  payload,
  point,
  stacked,
}: {
  active?: boolean
  payload?: readonly { name?: unknown; value?: unknown; color?: string }[]
  point?: TrendPoint
  stacked: boolean
}) {
  if (!active || !point) return null

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg px-3 py-2.5 text-xs min-w-[180px]">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">{point.label}</p>
      <p className="text-gray-600 dark:text-gray-300">Nilai: {fmtRp(point.total_cost)}</p>
      <p className="text-gray-600 dark:text-gray-300">Qty: {fmt(point.total_qty)}</p>
      <p className="text-gray-600 dark:text-gray-300">Transaksi: {fmt(point.count)}</p>
      {stacked && payload && payload.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
          {payload
            .filter((p) => Number(p.value) > 0)
            .map((p) => (
              <p key={String(p.name)} className="text-gray-500 dark:text-gray-400">
                {String(p.name)}: {fmtRp(Number(p.value))}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}

function ComparePanel({
  open,
  onToggle,
  periodALabel,
  compareBStart,
  compareBEnd,
  onCompareBStartChange,
  onCompareBEndChange,
  onCompare,
  compareData,
  isLoading,
  hasCompareB,
}: {
  open: boolean
  onToggle: () => void
  periodALabel: string
  compareBStart: string
  compareBEnd: string
  onCompareBStartChange: (v: string) => void
  onCompareBEndChange: (v: string) => void
  onCompare: () => void
  compareData?: WasteCompareResponse
  isLoading: boolean
  hasCompareB: boolean
}) {
  const diffColor =
    compareData == null
      ? 'text-gray-900 dark:text-white'
      : compareData.diff_cost > 0
        ? 'text-red-600 dark:text-red-400'
        : compareData.diff_cost < 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-gray-900 dark:text-white'

  const compareChartData = useMemo(() => {
    if (!compareData) return []
    return (Object.keys(SOURCE_LABELS) as WasteSource[]).map((s) => ({
      source: SOURCE_LABELS[s],
      period_a: compareData.period_a.breakdown_by_source[s].cost,
      period_b: compareData.period_b.breakdown_by_source[s].cost,
    }))
  }, [compareData])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
      >
        <span>Bandingkan dengan periode lain</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-gray-100 dark:border-gray-700">
          <div className="flex flex-wrap gap-4 items-end pt-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Periode pembanding — Dari
              </label>
              <input
                type="date"
                value={compareBStart}
                onChange={(e) => onCompareBStartChange(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Sampai
              </label>
              <input
                type="date"
                value={compareBEnd}
                onChange={(e) => onCompareBEndChange(e.target.value)}
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={onCompare}
              disabled={!compareBStart || !compareBEnd || isLoading}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Bandingkan
            </button>
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-red-500" />
            </div>
          )}

          {!isLoading && hasCompareB && compareData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Periode ini
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{periodALabel}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-3">
                    {fmtRp(compareData.period_a.total_cost)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Qty: {fmt(compareData.period_a.total_qty)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Periode pembanding
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-3">
                    {fmtRp(compareData.period_b.total_cost)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Qty: {fmt(compareData.period_b.total_qty)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Selisih
                  </p>
                  <p className={`text-xl font-bold mt-3 tabular-nums ${diffColor}`}>
                    {compareData.diff_cost >= 0 ? '+' : ''}
                    {fmtRp(compareData.diff_cost)}
                  </p>
                  <p className={`text-xs mt-1 tabular-nums ${diffColor}`}>
                    {compareData.diff_cost_pct != null
                      ? `${compareData.diff_cost_pct >= 0 ? '+' : ''}${fmt(compareData.diff_cost_pct)}%`
                      : '—'}
                    {' · '}
                    Qty {compareData.diff_qty >= 0 ? '+' : ''}
                    {fmt(compareData.diff_qty)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Breakdown per Sumber
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-[220px]">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Periode ini</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="source" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (Number(v) >= 1_000_000 ? `${Number(v) / 1_000_000}jt` : String(v))} />
                        <Tooltip formatter={(v: number) => fmtRp(v)} />
                        <Bar dataKey="period_a" name="Nilai" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-[220px]">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Periode pembanding</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="source" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (Number(v) >= 1_000_000 ? `${Number(v) / 1_000_000}jt` : String(v))} />
                        <Tooltip formatter={(v: number) => fmtRp(v)} />
                        <Bar dataKey="period_b" name="Nilai" fill="#64748b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {!isLoading && hasCompareB && !compareData && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Gagal memuat data perbandingan.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ByBranchTab({
  groups,
  isLoading,
  branchFiltered,
}: {
  groups: WasteBranchGroup[]
  isLoading: boolean
  branchFiltered: boolean
}) {
  const chartData = useMemo(
    () =>
      [...groups]
        .sort((a, b) => a.total_cost - b.total_cost)
        .map((g) => ({
          name: g.branch_name ?? g.branch_id.slice(0, 8),
          total_cost: g.total_cost,
        })),
    [groups],
  )

  if (branchFiltered) {
    return (
      <EmptyState message="Filter ke 'Semua Cabang' untuk melihat perbandingan antar cabang." />
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  if (groups.length === 0) {
    return <EmptyState message="Tidak ada data waste per cabang pada periode ini." />
  }

  const chartHeight = Math.max(200, groups.length * 44)

  return (
    <div className="space-y-6">
      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => (Number(v) >= 1_000_000 ? `${Number(v) / 1_000_000}jt` : String(v))}
            />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
            <Tooltip formatter={(v: number) => fmtRp(v)} />
            <Bar dataKey="total_cost" name="Total Nilai" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={`hsl(${350 - i * 12}, 70%, ${48 + i * 2}%)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="px-4 py-3 w-12">Rank</th>
              <th className="px-4 py-3">Cabang</th>
              <th className="px-4 py-3 text-right">Total Nilai</th>
              <th className="px-4 py-3 text-right">Total Qty</th>
              <th className="px-4 py-3 text-right">% dari Total</th>
              <th className="px-4 py-3 text-right">Bongkar Barang</th>
              <th className="px-4 py-3 text-right">Penyesuaian</th>
              <th className="px-4 py-3 text-right">Produksi</th>
              <th className="px-4 py-3 text-right">Opname</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {groups.map((g, i) => (
              <tr key={g.branch_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
                <td className="px-4 py-3 text-gray-500 tabular-nums">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {g.branch_name ?? g.branch_id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtRp(g.total_cost)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(g.total_qty)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {g.percentage_of_total != null ? `${fmt(g.percentage_of_total)}%` : '-'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  {fmtRp(g.breakdown_by_source.GOODS_PROCESSING.cost)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  {fmtRp(g.breakdown_by_source.STOCK_ADJUSTMENT.cost)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  {fmtRp(g.breakdown_by_source.PRODUCTION_ORDER.cost)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  {fmtRp(g.breakdown_by_source.DAILY_OPNAME.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
