import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useBranches } from '@/features/branches/api/branches.api'
import { useCategories } from '@/features/categories/api/categories.api'
import { useToast } from '@/contexts/ToastContext'
import {
  useWasteCompare,
  useWasteReport,
  useWasteReportByBranch,
  type WasteCompareParams,
  type WasteReportParams,
  type WasteSource,
} from '../api/wasteReport.api'
import { useShortageSummary, type ShortageReportParams } from '@/features/shortage-report/api/shortageReport.api'
import { groupWasteByItem } from '../utils/groupWasteByItem'
import { groupWasteByReason } from '../utils/groupWasteByReason'
import { fmtRp, fmtDate, SOURCE_LABELS } from '../components/wasteReport.constants'
import { EmptyState } from '../components/EmptyState'
import { DetailTab } from '../components/DetailTab'
import { ByItemTab } from '../components/ByItemTab'
import { ByReasonTab } from '../components/ByReasonTab'
import { ByBranchTab } from '../components/ByBranchTab'
import { MonthlyTab } from '../components/MonthlyTab'
import { WasteTrendChart } from '../components/WasteTrendChart'
import { ComparePanel } from '../components/ComparePanel'
import VarianceSummaryTab from '../components/VarianceSummaryTab'

type TabId = 'summary' | 'detail' | 'by-item' | 'by-reason' | 'by-branch' | 'monthly' | 'variance'

export default function WasteReportPage() {
  const navigate = useNavigate()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchId, setBranchId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [source, setSource] = useState<WasteSource | ''>('')
  const [recordSearch, setRecordSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('detail')
  const [applied, setApplied] = useState<WasteReportParams | null>(null)
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

  const shortageSummaryParams = useMemo<ShortageReportParams | null>(() => {
    if (!applied) return null
    return {
      start_date: applied.start_date,
      end_date: applied.end_date,
      ...(applied.branch_id ? { branch_id: applied.branch_id } : {}),
    }
  }, [applied])

  const { data: shortageSummary } = useShortageSummary(shortageSummaryParams ?? { start_date: '', end_date: '' }, !!shortageSummaryParams)

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

  const byReasonGroups = useMemo(
    () => groupWasteByReason(report?.records ?? []),
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
    { id: 'detail', label: 'Detail Transaksi' },
    { id: 'summary', label: 'Ringkasan' },
    { id: 'variance', label: 'Aktual vs Teoretis' },
    { id: 'by-reason', label: 'Per Alasan' },
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
                Agregasi waste terverifikasi dari Barang diproses, waste & breakdown, produksi harian, dan opname harian
              </p>
            </div>
          </div>
          {isFetching && <Loader2 className="w-5 h-5 animate-spin text-red-500" />}
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
                Modul
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

            {(shortageSummary?.unresolved_count ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => navigate('/inventory/shortage-report')}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-orange-200 dark:border-orange-800/50 bg-orange-50/80 dark:bg-orange-950/20 hover:shadow-md transition-shadow text-left"
              >
                <AlertOctagon className="w-8 h-8 text-orange-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
                    Shortage Belum Terselesaikan
                  </p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 tabular-nums">
                    {fmtRp(shortageSummary?.unresolved_cost)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {shortageSummary?.unresolved_count} kejadian · Klik untuk investigasi →
                  </p>
                </div>
              </button>
            )}

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
                  <div className="space-y-0">
                    <WasteTrendChart
                      records={report?.records ?? []}
                      startDate={applied.start_date}
                      endDate={applied.end_date}
                    />
                    <ComparePanel
                      embedded
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
                  </div>
                )}

                {activeTab === 'detail' && applied && (
                  <DetailTab
                    records={filteredRecords}
                    search={recordSearch}
                    onSearchChange={setRecordSearch}
                    branchNameById={branchNameById}
                    branches={branches}
                    startDate={applied.start_date}
                    endDate={applied.end_date}
                  />
                )}

                {activeTab === 'by-item' && <ByItemTab groups={byItemGroups} />}

                {activeTab === 'variance' && <VarianceSummaryTab params={params} />}

                {activeTab === 'by-reason' && (
                  <ByReasonTab groups={byReasonGroups} isLoading={isLoading} />
                )}

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
