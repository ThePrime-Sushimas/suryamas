import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText, Calendar } from 'lucide-react'
import {
  useReconSummary, useCashCountPending, useFiscalPeriodsStatus,
  useJournalSummary, useFeeDiscrepancySummary,
} from '../api/useDashboardApi'
import { WorkflowTracker } from '../components/WorkflowTracker'
import { MetricCard } from '../components/MetricCard'

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }

export default function DashboardAccountingPage() {
  const appliedFrom = fmtDate(firstOfMonth())
  const appliedTo = fmtDate(new Date())

  const recon = useReconSummary()
  const cashCount = useCashCountPending()
  const fiscalPeriods = useFiscalPeriodsStatus()
  const feeSummary = useFeeDiscrepancySummary(appliedFrom, appliedTo)

  const journals = useJournalSummary()

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
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Accounting</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Belum Rekon" value={recon.isLoading ? '...' : `${unreconciledCount}`} loading={recon.isLoading} color={unreconciledCount > 0 ? 'warn' : undefined} />
        <MetricCard label="Fee Discrepancy" value={feeSummary.isLoading ? '...' : `${feeDiscrepancyCount}`} loading={feeSummary.isLoading} color={feeDiscrepancyCount > 2 ? 'danger' : feeDiscrepancyCount > 0 ? 'warn' : undefined} />
        <MetricCard label="Jurnal Draft" value={journals.isLoading ? '...' : `${journals.data?.draft || 0}`} loading={journals.isLoading} color={journals.data?.draft ? 'warn' : undefined} />
        <MetricCard label="Approved" value={journals.isLoading ? '...' : `${journals.data?.approved || 0}`} loading={journals.isLoading} />
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
            ) : (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{journals.data?.posted || 0}</p>
                  <p className="text-[10px] text-gray-400">Posted</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{journals.data?.draft || 0}</p>
                  <p className="text-[10px] text-gray-400">Draft</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{journals.data?.approved || 0}</p>
                  <p className="text-[10px] text-gray-400">Approved</p>
                </div>
              </div>
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
