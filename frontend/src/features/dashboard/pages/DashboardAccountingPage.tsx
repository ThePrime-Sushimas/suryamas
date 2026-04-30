import { useMemo, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText, Calendar, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import {
  useReconSummary, useCashCountPending, useFiscalPeriodsStatus,
  useJournalSummary, useFeeDiscrepancySummary, useFailedTransactionsCount,
  useBalanceSheetHealth,
} from '../api/useDashboardApi'
import { useIncomeStatement } from '@/features/accounting/income-statement/api/incomeStatement.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { WorkflowTracker } from '../components/WorkflowTracker'
import { MetricCard } from '../components/MetricCard'
import { useQueryClient } from '@tanstack/react-query'

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1).replace('.0', '')} M`
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace('.0', '')} Jt`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)} Rb`
  return `${sign}${abs}`
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }

export default function DashboardAccountingPage() {
  const { currentBranch } = useBranchContextStore()
  const companyId = currentBranch?.company_id ?? ''
  const appliedFrom = fmtDate(firstOfMonth())
  const appliedTo = fmtDate(new Date())

  const recon = useReconSummary()
  const cashCount = useCashCountPending()
  const fiscalPeriods = useFiscalPeriodsStatus()
  const feeSummary = useFeeDiscrepancySummary(appliedFrom, appliedTo)
  const failedTrx = useFailedTransactionsCount()
  const journals = useJournalSummary()
  const pnl = useIncomeStatement({ date_from: appliedFrom, date_to: appliedTo, branch_ids: [] }, companyId, !!companyId)
  const bsHealth = useBalanceSheetHealth(companyId)

  const qc = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await qc.invalidateQueries({ queryKey: ['dashboard'] })
    await qc.invalidateQueries({ queryKey: ['income-statement'] })
    await qc.invalidateQueries({ queryKey: ['balance-sheet'] })
    setIsRefreshing(false)
  }, [qc])

  const unreconciledCount = recon.data?.unreconciled_count || 0
  const feeDiscrepancyCount = feeSummary.data?.totalPending || recon.data?.discrepancy_count || 0
  const periodLabel = `${appliedFrom} — ${appliedTo}`

  const fiscalStatus = useMemo(() => {
    if (!fiscalPeriods.data) return { open: 0, closed: 0, current: null as { period: string; is_open: boolean } | null }
    const now = new Date().toISOString().slice(0, 10)
    const current = fiscalPeriods.data.find(p => p.period_start <= now && p.period_end >= now) || null
    return {
      open: fiscalPeriods.data.filter(p => p.is_open).length,
      closed: fiscalPeriods.data.filter(p => !p.is_open).length,
      current,
    }
  }, [fiscalPeriods.data])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Accounting</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">{periodLabel}</span>
          <button onClick={handleRefresh} disabled={isRefreshing} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50" title="Refresh data">
            <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Balance Sheet Alert */}
      {bsHealth.isError ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0" />
          <p className="text-xs text-gray-400 italic">Gagal memuat status neraca</p>
        </div>
      ) : bsHealth.data && !bsHealth.data.is_balanced ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <p className="text-xs font-medium text-rose-700 dark:text-rose-400">
            Neraca tidak balance — selisih {fmtCurrency(Math.abs(bsHealth.data.difference))}
          </p>
          <Link to="/accounting/balance-sheet" className="ml-auto text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline shrink-0">
            Lihat Neraca →
          </Link>
        </div>
      ) : null}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Laba Bersih" value={`Rp ${fmtCompact(pnl.data?.summary?.net_income ?? 0)}`} loading={pnl.isLoading} error={pnl.isError} color={pnl.data?.summary && pnl.data.summary.net_income < 0 ? 'danger' : pnl.data?.summary && pnl.data.summary.net_income > 0 ? 'success' : undefined} />
        <MetricCard label="Belum Rekon" value={`${unreconciledCount}`} loading={recon.isLoading} error={recon.isError} color={unreconciledCount > 0 ? 'warn' : undefined} />
        <MetricCard label="Fee Disc." value={`${feeDiscrepancyCount}`} loading={feeSummary.isLoading} error={feeSummary.isError} color={feeDiscrepancyCount > 2 ? 'danger' : feeDiscrepancyCount > 0 ? 'warn' : undefined} />
        <MetricCard label="Jurnal Draft" value={`${journals.data?.draft || 0}`} loading={journals.isLoading} error={journals.isError} color={journals.data?.draft ? 'warn' : undefined} />
        <MetricCard label="Submitted" value={`${journals.data?.submitted || 0}`} loading={journals.isLoading} error={journals.isError} color={journals.data?.submitted ? 'warn' : undefined} />
        <MetricCard label="Trx Gagal" value={`${failedTrx.data || 0}`} loading={failedTrx.isLoading} error={failedTrx.isError} color={(failedTrx.data || 0) > 0 ? 'danger' : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
        {/* Workflow Tracker */}
        <WorkflowTracker
          periodLabel={periodLabel}
          totalStatements={recon.data?.total_statements || 0}
          unmatchedCount={recon.data?.unreconciled_count || 0}
          reconciledCount={recon.data?.reconciled_count || 0}
          unreconciledCount={unreconciledCount}
          cashPending={cashCount.data?.pendingCount || 0}
          feeDiscrepancyCount={feeDiscrepancyCount}
        />

        {/* Sidebar */}
        <div className="space-y-4">
          {/* P&L Summary */}
          <Link to="/accounting/income-statement" className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Laba Rugi Bulan Ini</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
            </div>
            {pnl.isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}</div>
            ) : pnl.isError ? (
              <p className="text-xs text-gray-400 italic">Gagal memuat data</p>
            ) : pnl.data?.summary ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Pendapatan</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{fmtCurrency(pnl.data.summary.total_revenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Beban</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{fmtCurrency(pnl.data.summary.total_expense)}</span>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between text-sm">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Laba Bersih</span>
                  <span className={`font-bold ${pnl.data.summary.net_income >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {fmtCurrency(pnl.data.summary.net_income)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Belum ada data jurnal posted</p>
            )}
          </Link>

          {/* Journal summary */}
          <Link to="/accounting/journals" className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Journal Entries</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
            {journals.isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}</div>
            ) : journals.isError ? (
              <p className="text-xs text-gray-400 italic">Gagal memuat data</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{journals.data?.posted || 0}</p>
                  <p className="text-[10px] text-gray-400">Posted</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{journals.data?.draft || 0}</p>
                  <p className="text-[10px] text-gray-400">Draft</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{journals.data?.submitted || 0}</p>
                  <p className="text-[10px] text-gray-400">Submitted</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{journals.data?.approved || 0}</p>
                  <p className="text-[10px] text-gray-400">Approved</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{journals.data?.rejected || 0}</p>
                  <p className="text-[10px] text-gray-400">Rejected</p>
                </div>
              </div>
            )}
          </Link>

          {/* Balance Sheet health */}
          <Link to="/accounting/balance-sheet" className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {bsHealth.data?.is_balanced === false
                  ? <AlertTriangle className="w-4 h-4 text-rose-500" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Neraca</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
            {bsHealth.isLoading ? (
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            ) : bsHealth.isError ? (
              <p className="text-xs text-gray-400 italic">Gagal memuat data</p>
            ) : bsHealth.data ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Total Aset</span>
                  <span className="font-semibold text-gray-900 dark:text-white">Rp {fmtCompact(Math.abs(bsHealth.data.total_asset))}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Kewajiban + Ekuitas</span>
                  <span className="font-semibold text-gray-900 dark:text-white">Rp {fmtCompact(Math.abs(bsHealth.data.total_liability_equity))}</span>
                </div>
                <p className={`text-[10px] font-medium mt-1 ${bsHealth.data.is_balanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {bsHealth.data.is_balanced ? '✓ Balance' : `✗ Selisih Rp ${fmtCompact(Math.abs(bsHealth.data.difference))}`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Belum ada data</p>
            )}
          </Link>

          {/* Fiscal period */}
          <Link to="/accounting/fiscal-periods" className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fiscal Period {new Date().getFullYear()}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
            {fiscalPeriods.isLoading ? (
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            ) : fiscalPeriods.isError ? (
              <p className="text-xs text-gray-400 italic">Gagal memuat data</p>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {fiscalStatus.current ? `${fiscalStatus.current.period} — ${fiscalStatus.current.is_open ? 'Open' : 'Closed'}` : 'Tidak ada periode aktif'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{fiscalStatus.open} open · {fiscalStatus.closed} closed</p>
              </div>
            )}
          </Link>
        </div>
      </div>
    </div>
  )
}
