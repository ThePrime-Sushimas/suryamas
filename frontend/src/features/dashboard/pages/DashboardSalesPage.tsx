import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, TrendingUp, TrendingDown, ArrowRight, Search, CheckCircle2, CalendarRange, Zap, CreditCard } from 'lucide-react'
import {
  usePosSalesRange, useAllBranches, useFailedTransactionsCount,
} from '../api/useDashboardApi'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useQuery } from '@tanstack/react-query'
import { companiesApi } from '@/features/companies/api/companies.api'
import { SalesOverview } from '../components/SalesOverview'
import { DailySalesChart } from '../components/DailySalesChart'
import { paymentDotColor } from '../utils/paymentDotColor'
import { VoidDetailModal } from '../components/VoidDetailModal'

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d }

export default function DashboardSalesPage() {
  const allUserBranches = useBranchContextStore((s) => s.branches)
  const todayStr = fmtDate(new Date())
  const yesterdayStr = fmtDate(yesterday())

  // Companies
  const companyIds = useMemo(() => [...new Set(allUserBranches.map((b) => b.company_id))], [allUserBranches])
  const companiesQuery = useQuery({
    queryKey: ['dashboard', 'companies', companyIds],
    queryFn: async () => { const res = await companiesApi.list(1, 50); return (res.data || []) as Array<{ id: string; company_name: string }> },
    staleTime: 10 * 60_000, enabled: companyIds.length > 0,
  })
  const companies = useMemo(() => {
    if (!companiesQuery.data) return companyIds.map((id) => ({ id, name: id }))
    return companyIds.map((id) => ({ id, name: companiesQuery.data.find((c) => c.id === id)?.company_name || id }))
  }, [companyIds, companiesQuery.data])

  const [pmCompanyTab, setPmCompanyTab] = useState<string | null>(null)
  const activePmCompany = pmCompanyTab || companies[0]?.id || null
  const companyBranchNames = useMemo(() => {
    if (!activePmCompany) return null
    return new Set(allUserBranches.filter((b) => b.company_id === activePmCompany).map((b) => b.branch_name.toLowerCase()))
  }, [activePmCompany, allUserBranches])

  // Date filter
  const [draftFrom, setDraftFrom] = useState(fmtDate(firstOfMonth()))
  const [draftTo, setDraftTo] = useState(fmtDate(new Date()))
  const [appliedFrom, setAppliedFrom] = useState<string | null>(null)
  const [appliedTo, setAppliedTo] = useState<string | null>(null)
  const isDirty = !appliedFrom || draftFrom !== appliedFrom || draftTo !== appliedTo
  const applyFilter = () => { setAppliedFrom(draftFrom); setAppliedTo(draftTo) }
  const hasApplied = !!appliedFrom && !!appliedTo

  // Today's data
  const todaySales = usePosSalesRange(todayStr, todayStr)
  const allBranches = useAllBranches()
  const failedTrxCount = useFailedTransactionsCount()

  // Range data
  const rangeSales = usePosSalesRange(appliedFrom || '', appliedTo || '')

  const isVoid = (r: { status: string }) => r.status === 'VOID'

  const todaySalesData = useMemo(() =>
    todaySales.data?.filter(r => r.sales_date?.slice(0, 10) === todayStr) || []
  , [todaySales.data, todayStr])

  const todayNonVoid = useMemo(() => todaySalesData.filter(r => !isVoid(r)), [todaySalesData])
  const todayVoidData = useMemo(() => todaySalesData.filter(isVoid), [todaySalesData])
  const todayVoidTotal = useMemo(() => todayVoidData.reduce((s, r) => s + r.grand_total, 0), [todayVoidData])
  const todayVoidTrx = useMemo(() => todayVoidData.reduce((s, r) => s + (r.void_transaction_count ?? 0), 0), [todayVoidData])

  const yesterdayData = useMemo(() =>
    todaySales.data?.filter(r => r.sales_date?.slice(0, 10) === yesterdayStr) || []
  , [todaySales.data, yesterdayStr])

  const rangeData = useMemo(() => {
    if (!hasApplied || !rangeSales.data) return []
    return rangeSales.data.filter(r => {
      const d = r.sales_date?.slice(0, 10)
      return d >= appliedFrom! && d <= appliedTo!
    })
  }, [rangeSales.data, appliedFrom, appliedTo, hasApplied])

  const rangeNonVoid = useMemo(() => rangeData.filter(r => !isVoid(r)), [rangeData])

  const todayTotal = useMemo(() => todaySalesData.filter(r => !isVoid(r)).reduce((s, r) => s + r.grand_total, 0), [todaySalesData])
  const todayFee = useMemo(() => todaySalesData.filter(r => !isVoid(r)).reduce((s, r) => s + r.total_fee_amount, 0), [todaySalesData])
  const yesterdayTotal = useMemo(() => yesterdayData.filter(r => !isVoid(r)).reduce((s, r) => s + r.grand_total, 0), [yesterdayData])
  const failedCount = failedTrxCount.data || 0

  const deltaPercent = useMemo(() => {
    if (todaySales.isLoading || !todaySales.data) return null
    if (yesterdayTotal === 0) return todayTotal > 0 ? 100 : 0
    return Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100)
  }, [todayTotal, yesterdayTotal, todaySales.isLoading, todaySales.data])

  const totalFee = useMemo(() => rangeData.filter(r => !isVoid(r)).reduce((s, r) => s + r.total_fee_amount, 0), [rangeData])

  const branchRanking = useMemo(() => {
    if (!rangeData.length) return []
    const map = new Map<string, { total: number; trx: number }>()
    for (const r of rangeData) {
      if (isVoid(r)) continue
      const n = r.branch_name || 'Unknown'; const e = map.get(n)
      if (e) { e.total += r.grand_total; e.trx += r.transaction_count } else map.set(n, { total: r.grand_total, trx: r.transaction_count })
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)
  }, [rangeData])

  const paymentMethods = useMemo(() => {
    if (!rangeData.length) return []
    const map = new Map<string, { name: string; type: string; total: number; trx: number; isVoid: boolean }>()
    let voidTotal = 0, voidTrx = 0
    for (const r of rangeData) {
      if (companyBranchNames && r.branch_name && !companyBranchNames.has(r.branch_name.toLowerCase())) continue
      if (isVoid(r)) { voidTotal += r.grand_total; voidTrx += r.void_transaction_count ?? 0; continue }
      const n = r.payment_methods?.name || 'Unknown'; const e = map.get(n)
      if (e) { e.total += r.grand_total; e.trx += r.transaction_count } else map.set(n, { name: n, type: r.payment_methods?.payment_type || '', total: r.grand_total, trx: r.transaction_count, isVoid: false })
    }
    const sorted = [...map.values()].sort((a, b) => b.total - a.total)
    if (voidTrx > 0) sorted.push({ name: 'VOID', type: 'void', total: voidTotal, trx: voidTrx, isVoid: true })
    return sorted
  }, [rangeData, companyBranchNames])

  const pmTotal = useMemo(() => paymentMethods.filter(pm => !pm.isVoid).reduce((s, pm) => s + pm.total, 0), [paymentMethods])

  const voidRows = useMemo(() =>
    rangeData.filter(isVoid).map(r => ({
      sales_date: r.sales_date,
      branch_name: r.branch_name,
      grand_total: r.grand_total,
      void_transaction_count: r.void_transaction_count ?? 0,
      skip_reason: r.skip_reason,
    }))
  , [rangeData])
  const [showVoidModal, setShowVoidModal] = useState(false)

  return (
    <div className="space-y-5">
      {/* ── Header + Date Filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Sales Dashboard</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Ringkasan penjualan & performa cabang</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
          <CalendarRange className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className="text-xs bg-transparent border-0 p-0 text-gray-700 dark:text-gray-300 focus:ring-0 w-[110px]" />
          <span className="text-[10px] text-gray-300 dark:text-gray-600">→</span>
          <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className="text-xs bg-transparent border-0 p-0 text-gray-700 dark:text-gray-300 focus:ring-0 w-[110px]" />
          <button onClick={applyFilter} className={`text-xs font-medium px-3 py-1 rounded-lg transition-all ${isDirty ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-default'}`}>
            Terapkan
          </button>
        </div>
      </div>

      {/* ── Failed Alert ── */}
      {failedCount > 0 && (
        <Link to="/pos-aggregates/failed-transactions" className="flex items-center justify-between bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800/40 px-4 py-3 group hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-xs font-medium text-rose-700 dark:text-rose-400">{failedCount} transaksi gagal belum di-handle</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-rose-300 group-hover:text-rose-500 transition-colors shrink-0" />
        </Link>
      )}

      {/* ── Summary Cards ── */}
      <div className={`grid grid-cols-1 gap-3 ${hasApplied && totalFee > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <SyncStatusCell allBranches={allBranches.data} salesData={todaySalesData} isLoading={allBranches.isLoading || todaySales.isLoading} />

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Penjualan Hari Ini</p>
          </div>
          {todaySales.isLoading ? <div className="h-6 w-28 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /> : (
            <>
              <p className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{fmt(todayTotal)}</p>
              {deltaPercent !== null && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium mt-1 px-1.5 py-0.5 rounded-full ${deltaPercent > 0 ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30' : deltaPercent < 0 ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30' : 'text-gray-400 bg-gray-50 dark:bg-gray-700'}`}>
                  {deltaPercent > 0 ? <TrendingUp className="w-3 h-3" /> : deltaPercent < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {deltaPercent > 0 ? '+' : ''}{deltaPercent}% vs kemarin
                </span>
              )}
            </>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <CreditCard className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fee (MDR) Hari Ini</p>
          </div>
          {todaySales.isLoading ? <div className="h-6 w-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /> : (
            <p className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{fmt(todayFee)}</p>
          )}
        </div>

        {hasApplied && totalFee > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <CreditCard className="w-3.5 h-3.5 text-violet-500" />
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Fee (MDR)</p>
            </div>
            {rangeSales.isLoading ? <div className="h-6 w-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /> : (
              <>
                <p className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{fmt(totalFee)}</p>
                <p className="text-[10px] text-gray-400 mt-1">{appliedFrom} — {appliedTo}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Hari Ini + VOID ── */}
      <div className={`grid gap-4 items-start ${!todaySales.isLoading && todayVoidTrx > 0 ? 'grid-cols-1 lg:grid-cols-[1fr_380px]' : 'grid-cols-1'}`}>
        <SalesOverview data={todayNonVoid} isLoading={todaySales.isLoading} isFetching={todaySales.isFetching} onRefresh={() => todaySales.refetch()} />

        {!todaySales.isLoading && todayVoidTrx > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-rose-200 dark:border-rose-800/40 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-rose-100 dark:border-rose-800/30 flex items-center justify-between bg-rose-50/50 dark:bg-rose-900/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <h3 className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wide">VOID Hari Ini</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 rounded-full">{todayVoidTrx} trx</span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{fmt(todayVoidTotal)}</span>
              </div>
            </div>
            <div className="divide-y divide-rose-100 dark:divide-rose-800/30 flex-1 overflow-y-auto max-h-80">
              {todayVoidData.map((r, i) => (
                <div key={i} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{r.branch_name || 'Unknown'}</span>
                      <span className="text-[10px] text-gray-400 ml-2">{r.void_transaction_count ?? 0} trx</span>
                    </div>
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400 line-through">{fmt(r.grand_total)}</span>
                  </div>
                  {r.skip_reason && (
                    <p className="text-[10px] text-rose-500 dark:text-rose-400/70 mt-1 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded">
                      {r.skip_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Range Section ── */}
      {!hasApplied ? (
        <div className="bg-white dark:bg-gray-800/60 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
            <Search className="w-5 h-5 text-gray-300 dark:text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Belum ada data range</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Pilih rentang tanggal dan klik <span className="font-semibold text-blue-600 dark:text-blue-400">Terapkan</span> untuk melihat chart & detail cabang</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Chart + Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_530px] gap-4 items-start">
            <DailySalesChart data={rangeNonVoid} isLoading={rangeSales.isLoading} />
            <SidebarTabs
              branchRanking={branchRanking} paymentMethods={paymentMethods} pmTotal={pmTotal}
              companies={companies} activePmCompany={activePmCompany} onCompanyTab={setPmCompanyTab}
              isLoading={rangeSales.isLoading}
              onVoidClick={() => setShowVoidModal(true)}
            />
          </div>
        </div>
      )}

      <VoidDetailModal isOpen={showVoidModal} onClose={() => setShowVoidModal(false)} data={voidRows} />
    </div>
  )
}

/* ── Sidebar: Cabang / Payment Method tabs ── */

type SidebarTab = 'cabang' | 'payment'

function SidebarTabs({ branchRanking, paymentMethods, pmTotal, companies, activePmCompany, onCompanyTab, isLoading, onVoidClick }: {
  branchRanking: Array<{ name: string; total: number; trx: number }>
  paymentMethods: Array<{ name: string; type: string; total: number; trx: number; isVoid: boolean }>
  pmTotal: number
  companies: Array<{ id: string; name: string }>
  activePmCompany: string | null
  onCompanyTab: (id: string) => void
  isLoading: boolean
  onVoidClick: () => void
}) {
  const [tab, setTab] = useState<SidebarTab>('cabang')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        {(['cabang', 'payment'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 text-xs font-medium py-2.5 text-center transition-colors relative ${tab === t ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
            {t === 'cabang' ? 'Omset Cabang' : 'Payment Method'}
            {tab === t && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />}
          </button>
        ))}
      </div>

      {tab === 'payment' && companies.length > 1 && (
        <div className="px-3 pt-2 pb-0 flex justify-center gap-1">
          {companies.map((c) => (
            <button key={c.id} onClick={() => onCompanyTab(c.id)} className={`text-[10px] font-medium px-4 py-1.5 rounded-t transition-colors ${activePmCompany === c.id ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="p-3 space-y-2 flex-1">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-7 bg-gray-50 dark:bg-gray-700 rounded animate-pulse" />)}
        </div>
      ) : tab === 'cabang' ? (
        branchRanking.length === 0 ? <div className="p-8 text-center text-xs text-gray-400">Belum ada data</div> : (
          <div className="p-2 flex-1 overflow-y-auto max-h-80">
            {branchRanking.map((b, i) => {
              const pct = branchRanking[0].total > 0 ? (b.total / branchRanking[0].total) * 100 : 0
              return (
                <div key={b.name} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : i < 3 ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{b.name}</span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 shrink-0 ml-2">{fmt(b.total)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${i === 0 ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-blue-300 dark:bg-blue-600'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{b.trx} trx</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        paymentMethods.length === 0 ? <div className="p-8 text-center text-xs text-gray-400">Belum ada data</div> : (
          <div className="p-3 flex-1 overflow-y-auto max-h-80 space-y-1">
            {pmTotal > 0 && <p className="text-[10px] text-gray-400 text-right mb-1.5">Total: {fmt(pmTotal)}</p>}
            {paymentMethods.map((pm) => {
              if (pm.isVoid) return (
                <button key="VOID" onClick={onVoidClick} className="flex items-center gap-2 py-1.5 w-full border-t border-dashed border-gray-200 dark:border-gray-700 mt-1.5 pt-2 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-lg transition-colors cursor-pointer px-1">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-rose-500" />
                  <span className="flex-1 text-xs text-rose-600 dark:text-rose-400 line-through truncate text-left">VOID</span>
                  <span className="text-[11px] text-rose-400 shrink-0">{pm.trx} trx</span>
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 w-24 text-right shrink-0">{fmt(pm.total)}</span>
                </button>
              )
              const dotColor = paymentDotColor(pm.type)
              const share = pmTotal > 0 ? ((pm.total / pmTotal) * 100).toFixed(1) : '0'
              return (
                <div key={pm.name} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                  <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">{pm.name}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full shrink-0">{share}%</span>
                  <span className="text-[11px] text-gray-400 shrink-0">{pm.trx} trx</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200 w-24 text-right shrink-0">{fmt(pm.total)}</span>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

/* ── Sync Status Cell ── */

function SyncStatusCell({ allBranches, salesData, isLoading }: { allBranches: Array<{ id: string; branch_name: string }> | undefined; salesData: Array<{ branch_name: string | null }> | undefined; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const missed = useMemo(() => {
    if (!allBranches || !salesData) return []
    const synced = new Set(salesData.map((r) => r.branch_name?.toLowerCase()))
    return allBranches.filter((b) => !synced.has(b.branch_name.toLowerCase()))
  }, [allBranches, salesData])

  if (isLoading) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="h-6 w-24 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
    </div>
  )

  if (missed.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800/40 p-4 shadow-sm">
        <div className="flex items-center gap-1.5 mb-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sync Cabang</p>
        </div>
        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">Semua OK</p>
      </div>
    )
  }

  return (
    <button onClick={() => setExpanded((v) => !v)} className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800/40 p-4 shadow-sm text-left w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sync Cabang</p>
      </div>
      <p className="text-base font-bold text-amber-600 dark:text-amber-400">{missed.length} belum sync</p>
      {expanded && (
        <div className="flex flex-wrap gap-1 mt-2">
          {missed.map((b) => (
            <span key={b.id} className="text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
              {b.branch_name}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
