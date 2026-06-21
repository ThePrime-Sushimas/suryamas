import { useState, useMemo } from 'react'
import { useAuthStore } from '@/features/auth'
import { useBranchContext } from '@/features/branch_context'
import { Link } from 'react-router-dom'
import { AlertTriangle, TrendingUp, TrendingDown, ArrowRight, Search, CheckCircle2 } from 'lucide-react'
import { feeDiscrepancyApi } from '@/features/bank-reconciliation/fee-discrepancy-review/api/fee-discrepancy.api'
import {
  usePosSalesRange, useReconSummary, useCashCountPending,
  useAllBranches, useBankAccountsList, useRecentBankStatementImports,
  useFiscalPeriodsStatus, useFailedTransactionsCount,
} from '../api/useDashboardApi'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useQuery } from '@tanstack/react-query'
import { companiesApi } from '@/features/companies/api/companies.api'
import { WorkflowTracker } from '../components/WorkflowTracker'
import { SalesOverview } from '../components/SalesOverview'
import { FinanceOverview } from '../components/FinanceOverview'
import { DailySalesChart } from '../components/DailySalesChart'
import { paymentDotColor } from '../utils/paymentDotColor'
import { VoidDetailModal } from '../components/VoidDetailModal'

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d }

export default function DashboardPage() {
  const { user } = useAuthStore()
  const currentBranch = useBranchContext()
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

  // Branch filter — allows user to narrow down which branches are shown
  const companyBranches = useMemo(() =>
    allUserBranches.filter(b => b.company_id === activePmCompany),
    [allUserBranches, activePmCompany]
  )
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set())
  const activeBranchFilter = useMemo(() => {
    if (selectedBranchIds.size === 0) return null // null = show all
    return selectedBranchIds
  }, [selectedBranchIds])
  const toggleBranch = (branchId: string) => {
    setSelectedBranchIds(prev => {
      const next = new Set(prev)
      if (next.has(branchId)) next.delete(branchId); else next.add(branchId)
      return next
    })
  }
  const clearBranchFilter = () => setSelectedBranchIds(new Set())

  // Set of branch_ids for filtering sales data (uses UUID, not name)
  const activeBranchIdSet = useMemo(() => {
    if (!activePmCompany) return null
    const branches = activeBranchFilter
      ? allUserBranches.filter(b => b.company_id === activePmCompany && activeBranchFilter.has(b.branch_id))
      : allUserBranches.filter(b => b.company_id === activePmCompany)
    return new Set(branches.map(b => b.branch_id))
  }, [activePmCompany, allUserBranches, activeBranchFilter])

  // Keep branch names set for payment methods section (which still uses branch_name for display grouping)
  const companyBranchNames = useMemo(() => {
    if (!activeBranchIdSet) return null
    const branches = allUserBranches.filter(b => activeBranchIdSet.has(b.branch_id))
    return new Set(branches.map(b => b.branch_name.toLowerCase()))
  }, [activeBranchIdSet, allUserBranches])

  // Date filter (manual apply)
  const [draftFrom, setDraftFrom] = useState(fmtDate(firstOfMonth()))
  const [draftTo, setDraftTo] = useState(fmtDate(new Date()))
  const [appliedFrom, setAppliedFrom] = useState(fmtDate(firstOfMonth()))
  const [appliedTo, setAppliedTo] = useState(fmtDate(new Date()))
  const isDirty = draftFrom !== appliedFrom || draftTo !== appliedTo
  const applyFilter = () => { setAppliedFrom(draftFrom); setAppliedTo(draftTo) }

  // Data hooks — single query covers appliedFrom..appliedTo + yesterday for delta
  const sales = usePosSalesRange(appliedFrom, appliedTo)
  const recon = useReconSummary()
  const cashCount = useCashCountPending()
  const feeSummary = useQuery({
    queryKey: ['dashboard', 'fee-discrepancy-summary', appliedFrom, appliedTo],
    queryFn: () => feeDiscrepancyApi.summary({ dateFrom: appliedFrom, dateTo: appliedTo }),
    enabled: !!appliedFrom && !!appliedTo,
    retry: false,
  })
  const allBranches = useAllBranches()
  const bankAccounts = useBankAccountsList()
  const bankImports = useRecentBankStatementImports()
  const fiscalPeriods = useFiscalPeriodsStatus()
  const failedTrxCount = useFailedTransactionsCount()
  const todayStr = fmtDate(new Date())
  const yesterdayStr = fmtDate(yesterday())

  const isVoid = (r: { status: string }) => r.status === 'VOID'

  // Filter data within the user-applied range (exclude the extra yesterday row)
  const rangeData = useMemo(() => {
    let data = sales.data?.filter(r => {
      const d = r.sales_date?.slice(0, 10)
      return d >= appliedFrom && d <= appliedTo
    }) || []
    // Apply branch filter using branch_id (UUID) — more robust than name matching
    if (activeBranchIdSet) {
      data = data.filter(r => r.branch_id && activeBranchIdSet.has(r.branch_id))
    }
    return data
  }, [sales.data, appliedFrom, appliedTo, activeBranchIdSet])

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
  const unreconciledCount = recon.data?.unreconciled_count || 0
  const feeDiscrepancyCount = feeSummary.data?.totalPending || recon.data?.discrepancy_count || 0
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

  const periodLabel = `${appliedFrom} — ${appliedTo}`

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6">S</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Suryamas</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Finance Management System</p>
          <div className="flex gap-3">
            <Link to="/login" className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-center">Login</Link>
            <Link to="/register" className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold text-center">Register</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <div className="flex items-center gap-2">
            <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <span className="text-xs text-gray-400">—</span>
            <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <button onClick={applyFilter} disabled={!isDirty} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${isDirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-default'}`}>
              <Search className="w-3 h-3" /> Terapkan
            </button>
          </div>
        </div>

        {/* Branch Filter */}
        {companyBranches.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Branch:</span>
            {companyBranches.map(b => {
              const isSelected = selectedBranchIds.size === 0 || selectedBranchIds.has(b.branch_id)
              return (
                <button
                  key={b.branch_id}
                  onClick={() => toggleBranch(b.branch_id)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 line-through'
                  }`}
                >
                  {b.branch_name}
                </button>
              )
            })}
            {selectedBranchIds.size > 0 && (
              <button onClick={clearBranchFilter} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">
                Semua
              </button>
            )}
          </div>
        )}

        {/* Summary bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-3">
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
          <MetricCard label="Belum Rekon" value={recon.isLoading ? '...' : `${unreconciledCount}`} loading={recon.isLoading} color={unreconciledCount > 0 ? 'warn' : undefined} />
          <MetricCard label="Fee Discrepancy" value={feeSummary.isLoading && recon.isLoading ? '...' : `${feeDiscrepancyCount}`} loading={feeSummary.isLoading && recon.isLoading} color={feeDiscrepancyCount > 2 ? 'danger' : feeDiscrepancyCount > 0 ? 'warn' : undefined} />
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

        {/* Workflow + Detail Hari Ini + Finance */}
        <div className="grid grid-cols-1 lg:grid-cols-[58fr_42fr] gap-4 items-start">
          <WorkflowTracker periodLabel={periodLabel} totalStatements={recon.data?.total_statements || 0} unmatchedCount={recon.data?.unreconciled_count || 0} reconciledCount={recon.data?.reconciled_count || 0} unreconciledCount={unreconciledCount} cashPending={cashCount.data?.pendingCount || 0} cashOpenCount={cashCount.data?.openCount || 0} cashCountedNotDeposited={0} feeDiscrepancyCount={feeDiscrepancyCount} expenseUncategorized={0} expenseUnjournaled={0} journalDraft={0} journalPosted={0} />
          <div className="space-y-4">
            <SalesOverview data={todaySalesData} isLoading={sales.isLoading} isFetching={sales.isFetching} onRefresh={() => sales.refetch()} />
            <FinanceOverview bankAccounts={bankAccounts.data} bankImports={bankImports.data} fiscalPeriods={fiscalPeriods.data} totalFee={totalFee} isLoading={bankAccounts.isLoading || fiscalPeriods.isLoading} />
          </div>
        </div>

        <footer className="pt-4 pb-2 text-center text-xs text-gray-400 dark:text-gray-500">
          © {new Date().getFullYear()} CV Suryamas Pangan · {currentBranch?.branch_name || ''}
        </footer>

        <VoidDetailModal isOpen={showVoidModal} onClose={() => setShowVoidModal(false)} data={voidRows} />
      </div>
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

function MetricCard({ label, value, loading, color }: { label: string; value: string; loading: boolean; color?: 'warn' | 'danger' }) {
  const vc = color === 'danger' ? 'text-rose-600 dark:text-rose-400' : color === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'
  return (
    <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      {loading ? <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : <p className={`text-base font-semibold ${vc}`}>{value}</p>}
    </div>
  )
}

function SyncStatusCell({ allBranches, salesData, isLoading }: { allBranches: Array<{ id: string; branch_name: string; status: string }> | undefined; salesData: Array<{ branch_name: string | null; synced_at?: string | null }> | undefined; isLoading: boolean }) {
  const [expanded, setExpanded] = useState(false)

  const { synced, missed } = useMemo(() => {
    if (!allBranches || !salesData) return { synced: [], missed: [] }
    const activeBranches = allBranches.filter((b) => b.status === 'active')
    const syncMap = new Map<string, string>()
    for (const r of salesData) {
      if (!r.branch_name || !r.synced_at) continue
      const key = r.branch_name.toLowerCase()
      const existing = syncMap.get(key)
      if (!existing || r.synced_at > existing) syncMap.set(key, r.synced_at)
    }
    const syncedBranches = activeBranches
      .filter((b) => syncMap.has(b.branch_name.toLowerCase()))
      .map((b) => ({ ...b, synced_at: syncMap.get(b.branch_name.toLowerCase())! }))
      .sort((a, b) => b.synced_at.localeCompare(a.synced_at))
    const missedBranches = activeBranches.filter((b) => !syncMap.has(b.branch_name.toLowerCase()))
    return { synced: syncedBranches, missed: missedBranches }
  }, [allBranches, salesData])

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  if (isLoading) return <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3"><div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>

  const total = synced.length + missed.length

  return (
    <button onClick={() => setExpanded((v) => !v)} className={`rounded-lg p-3 text-left w-full ${missed.length === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
      <p className={`text-[11px] font-medium uppercase tracking-wide mb-0.5 ${missed.length === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>Sync Cabang</p>
      <p className={`text-base font-semibold flex items-center gap-1 ${missed.length === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
        {missed.length === 0 ? <><CheckCircle2 className="w-4 h-4" /> Semua OK</> : <><AlertTriangle className="w-4 h-4" /> {missed.length} belum</>}
        <span className="text-[10px] font-normal text-gray-400 ml-1">{synced.length}/{total}</span>
      </p>
      {expanded && (
        <div className="mt-2 space-y-0.5">
          {synced.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-[10px]">
              <span className="text-gray-600 dark:text-gray-300">{b.branch_name}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono">{fmtTime(b.synced_at)}</span>
            </div>
          ))}
          {missed.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-[10px]">
              <span className="text-gray-600 dark:text-gray-300">{b.branch_name}</span>
              <span className="text-amber-500">—</span>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}
