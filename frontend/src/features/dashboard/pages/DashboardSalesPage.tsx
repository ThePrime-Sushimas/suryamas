import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, TrendingUp, TrendingDown, ArrowRight, Search, CheckCircle2 } from 'lucide-react'
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

  // Date filter (manual apply)
  const [draftFrom, setDraftFrom] = useState(fmtDate(firstOfMonth()))
  const [draftTo, setDraftTo] = useState(fmtDate(new Date()))
  const [appliedFrom, setAppliedFrom] = useState(fmtDate(firstOfMonth()))
  const [appliedTo, setAppliedTo] = useState(fmtDate(new Date()))
  const isDirty = draftFrom !== appliedFrom || draftTo !== appliedTo
  const applyFilter = () => { setAppliedFrom(draftFrom); setAppliedTo(draftTo) }

  // Data hooks — single query covers appliedFrom..appliedTo + yesterday for delta
  const sales = usePosSalesRange(appliedFrom, appliedTo)
  const allBranches = useAllBranches()
  const failedTrxCount = useFailedTransactionsCount()
  const todayStr = fmtDate(new Date())
  const yesterdayStr = fmtDate(yesterday())

  const isVoid = (r: { status: string }) => r.status === 'VOID'

  // Filter data within the user-applied range (exclude the extra yesterday row)
  const rangeData = useMemo(() =>
    sales.data?.filter(r => {
      const d = r.sales_date?.slice(0, 10)
      return d >= appliedFrom && d <= appliedTo
    }) || []
  , [sales.data, appliedFrom, appliedTo])

  // Derive today's sales from the range data
  const todaySalesData = useMemo(() =>
    rangeData.filter(r => r.sales_date?.slice(0, 10) === todayStr)
  , [rangeData, todayStr])

  // Yesterday data derived from the same query
  const yesterdayData = useMemo(() =>
    sales.data?.filter(r => r.sales_date?.slice(0, 10) === yesterdayStr) || []
  , [sales.data, yesterdayStr])

  // Computed — exclude VOID from totals
  const todayTotal = useMemo(() => todaySalesData.filter(r => !isVoid(r)).reduce((s, r) => s + r.grand_total, 0), [todaySalesData])
  const totalFee = useMemo(() => rangeData.filter(r => !isVoid(r)).reduce((s, r) => s + r.total_fee_amount, 0), [rangeData])
  const yesterdayTotal = useMemo(() => yesterdayData.filter(r => !isVoid(r)).reduce((s, r) => s + r.grand_total, 0), [yesterdayData])
  const failedCount = failedTrxCount.data || 0

  const deltaPercent = useMemo(() => {
    if (sales.isLoading || !sales.data) return null
    if (yesterdayTotal === 0) return todayTotal > 0 ? 100 : 0
    return Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100)
  }, [todayTotal, yesterdayTotal, sales.isLoading, sales.data])

  const branchRanking = useMemo(() => {
    if (!rangeData.length) return []
    const map = new Map<string, { total: number; trx: number }>()
    for (const r of rangeData) {
      if (isVoid(r)) continue
      const n = r.branch_name || 'Unknown'; const e = map.get(n); if (e) { e.total += r.grand_total; e.trx += r.transaction_count } else map.set(n, { total: r.grand_total, trx: r.transaction_count })
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)
  }, [rangeData])

  const paymentMethods = useMemo(() => {
    if (!rangeData.length) return []
    const map = new Map<string, { name: string; type: string; total: number; trx: number; isVoid: boolean }>()
    let voidTotal = 0, voidTrx = 0
    for (const r of rangeData) {
      if (companyBranchNames && r.branch_name && !companyBranchNames.has(r.branch_name.toLowerCase())) continue
      if (isVoid(r)) {
        voidTotal += r.grand_total
        voidTrx += r.void_transaction_count ?? 0
        continue
      }
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
    <>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sales</h1>
          <div className="flex items-center gap-2">
            <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <button onClick={applyFilter} disabled={!isDirty} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${isDirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-default'}`}>
              <Search className="w-3 h-3" /> Terapkan
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SyncStatusCell allBranches={allBranches.data} salesData={todaySalesData} isLoading={allBranches.isLoading || sales.isLoading} />
          <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Penjualan Hari Ini</p>
            {sales.isLoading ? <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : (
              <>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{fmt(todayTotal)}</p>
                {deltaPercent !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium mt-0.5 ${deltaPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : deltaPercent < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
                    {deltaPercent > 0 ? <TrendingUp className="w-3 h-3" /> : deltaPercent < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                    {deltaPercent > 0 ? '+' : ''}{deltaPercent}% vs kemarin
                  </span>
                )}
              </>
            )}
          </div>
          <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Total Fee (MDR)</p>
            {sales.isLoading ? <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : <p className="text-base font-semibold text-gray-900 dark:text-white">{fmt(totalFee)}</p>}
          </div>
        </div>

        {/* Chart + Sidebar (Cabang / Payment Method tabs) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_530px] gap-4 items-start">
          <DailySalesChart data={rangeData} isLoading={sales.isLoading} />
          <SidebarTabs
            branchRanking={branchRanking} paymentMethods={paymentMethods} pmTotal={pmTotal}
            companies={companies} activePmCompany={activePmCompany} onCompanyTab={setPmCompanyTab}
            isLoading={sales.isLoading}
            onVoidClick={() => setShowVoidModal(true)}
          />
        </div>

        {/* Failed alert */}
        {failedCount > 0 && (
          <Link to="/pos-aggregates/failed-transactions" className="flex items-center justify-between bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800/40 px-4 py-3 group hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors duration-120">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="text-xs font-medium text-rose-700 dark:text-rose-400">{failedCount} transaksi gagal belum di-handle</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-rose-300 group-hover:text-rose-500 transition-colors shrink-0" />
          </Link>
        )}

        <SalesOverview data={todaySalesData} isLoading={sales.isLoading} isFetching={sales.isFetching} onRefresh={() => sales.refetch()} />

      <VoidDetailModal isOpen={showVoidModal} onClose={() => setShowVoidModal(false)} data={voidRows} />
    </>
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
      {/* Tab header */}
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        <button onClick={() => setTab('cabang')} className={`flex-1 text-xs font-medium py-2.5 text-center transition-colors ${tab === 'cabang' ? 'text-gray-800 dark:text-gray-200 border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          Omset Cabang
        </button>
        <button onClick={() => setTab('payment')} className={`flex-1 text-xs font-medium py-2.5 text-center transition-colors ${tab === 'payment' ? 'text-gray-800 dark:text-gray-200 border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
          Payment Method
        </button>
      </div>

      {/* Company sub-tabs (only on payment tab, if >1 company) */}
      {tab === 'payment' && companies.length > 1 && (
        <div className="px-3 pt-1.5 pb-0 flex justify-center gap-1 border-b border-gray-50 dark:border-gray-700">
          {companies.map((c) => (
            <button key={c.id} onClick={() => onCompanyTab(c.id)} className={`text-[10px] font-medium px-4 py-1.5 rounded-t transition-colors ${activePmCompany === c.id ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="p-3 space-y-2 flex-1">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-7 bg-gray-50 dark:bg-gray-700 rounded animate-pulse" />)}
        </div>
      ) : tab === 'cabang' ? (
        branchRanking.length === 0 ? <div className="p-6 text-center text-xs text-gray-400">Belum ada data</div> : (
          <div className="p-2 flex-1 overflow-y-auto max-h-80">
            {branchRanking.map((b, i) => {
              const pct = branchRanking[0].total > 0 ? (b.total / branchRanking[0].total) * 100 : 0
              return (
                <div key={b.name} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-120">
                  <span className="text-[10px] font-semibold text-gray-400 w-4 text-right shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{b.name}</span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 shrink-0 ml-2">{fmt(b.total)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 dark:bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
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
        paymentMethods.length === 0 ? <div className="p-6 text-center text-xs text-gray-400">Belum ada data</div> : (
          <div className="p-3 flex-1 overflow-y-auto max-h-80 space-y-1.5">
            {pmTotal > 0 && <p className="text-[10px] text-gray-400 text-right mb-1">Total: {fmt(pmTotal)}</p>}
            {paymentMethods.map((pm) => {
              if (pm.isVoid) return (
                <button key="VOID" onClick={onVoidClick} className="flex items-center gap-2 py-1 w-full border-t border-dashed border-gray-200 dark:border-gray-700 mt-1 pt-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded transition-colors cursor-pointer">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-rose-500" />
                  <span className="flex-1 text-xs text-rose-600 dark:text-rose-400 line-through truncate text-left">VOID</span>
                  <span className="text-[10px] text-rose-400 shrink-0">—</span>
                  <span className="text-[11px] text-rose-400 shrink-0">{pm.trx} trx</span>
                  <span className="text-xs font-medium text-rose-600 dark:text-rose-400 w-24 text-right shrink-0">{fmt(pm.total)}</span>
                </button>
              )
              const dotColor = paymentDotColor(pm.type)
              const share = pmTotal > 0 ? ((pm.total / pmTotal) * 100).toFixed(1) : '0'
              return (
                <div key={pm.name} className="flex items-center gap-2 py-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                  <span className="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate">{pm.name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{share}%</span>
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

/* ── Small components ── */

function SyncStatusCell({ allBranches, salesData, isLoading }: { allBranches: Array<{ id: string; branch_name: string }> | undefined; salesData: Array<{ branch_name: string | null }> | undefined; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const missed = useMemo(() => {
    if (!allBranches || !salesData) return []
    const synced = new Set(salesData.map((r) => r.branch_name?.toLowerCase()))
    return allBranches.filter((b) => !synced.has(b.branch_name.toLowerCase()))
  }, [allBranches, salesData])

  if (isLoading) return <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3"><div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>

  if (missed.length === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
        <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-0.5">Sync Cabang</p>
        <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Semua OK</p>
      </div>
    )
  }

  return (
    <button onClick={() => setExpanded((v) => !v)} className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-left w-full">
      <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-0.5">Sync Cabang</p>
      <p className="text-base font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {missed.length} belum</p>
      {expanded && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {missed.map((b) => (
            <span key={b.id} className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded">
              {b.branch_name}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
