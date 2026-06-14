import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Download,
  Loader2,
  Package,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useBranches } from '@/features/branches/api/branches.api'
import { useCategories } from '@/features/categories/api/categories.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import {
  useWasteReport,
  type WasteRecord,
  type WasteReportParams,
  type WasteSource,
  type MonthlyOpnameSelisih,
} from '../api/wasteReport.api'
import { groupWasteByItem } from '../utils/groupWasteByItem'
import { exportWasteReportExcel } from '../utils/wasteReportExport'

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

type TabId = 'summary' | 'detail' | 'by-item' | 'monthly'

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
    { id: 'monthly', label: 'Indikasi Kebocoran Bulanan' },
  ]

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
                className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[160px]"
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
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                label="Total Qty Waste"
                value={fmt(report?.summary.total_waste_qty)}
                icon={<Package className="w-5 h-5 text-red-500" />}
              />
              <SummaryCard
                label="Total Nilai Waste"
                value={fmtRp(report?.summary.total_waste_cost)}
                icon={<BarChart3 className="w-5 h-5 text-red-500" />}
              />
              <SummaryCard
                label="% dari Pembelian"
                value={
                  report?.summary.percentage_of_purchase != null
                    ? `${fmt(report.summary.percentage_of_purchase)}%`
                    : '-'
                }
                sub="vs invoice pembelian posted"
                icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
              />
              <SummaryCard
                label="Jumlah Transaksi"
                value={fmt(report?.records.length)}
                icon={<Trash2 className="w-5 h-5 text-gray-500" />}
              />
            </div>

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
                {activeTab === 'summary' && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ringkasan ditampilkan di atas. Gunakan tab lain untuk detail transaksi, ranking produk,
                    atau indikasi kebocoran dari opname bulanan (belum terverifikasi sebagai waste).
                  </p>
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

function SummaryCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 shadow-sm p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-900/50">{icon}</div>
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
  if (records.length === 0) {
    return <EmptyState message="Tidak ada transaksi waste pada periode ini." />
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari produk, nomor dokumen, alasan..."
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
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Cabang</th>
              <th className="px-4 py-3">Sumber</th>
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Nilai</th>
              <th className="px-4 py-3">Alasan</th>
              <th className="px-4 py-3">Referensi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {records.map((r) => (
              <tr key={recordKey(r)} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                  {fmtDate(r.date)}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[240px]">
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
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[240px]">
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
    </div>
  )
}

function ByItemTab({ groups }: { groups: ReturnType<typeof groupWasteByItem> }) {
  if (groups.length === 0) {
    return <EmptyState message="Tidak ada produk dengan waste pada periode ini." />
  }

  return (
    <div className="space-y-2">
      {groups.map((g, i) => (
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
