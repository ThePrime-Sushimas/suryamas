import { useMemo } from 'react'
import { useBranchContext } from '@/features/branch_context'
import {
  usePosSalesRange, useReconSummary, useCashCountPending,
  useBankAccountsList, useRecentBankStatementImports,
  useFiscalPeriodsStatus, useFeeDiscrepancySummary,
} from '../api/useDashboardApi'
import { FinanceOverview } from '../components/FinanceOverview'
import { MetricCard } from '../components/MetricCard'

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }

export default function DashboardFinancePage() {
  const currentBranch = useBranchContext()
  const appliedFrom = fmtDate(firstOfMonth())
  const appliedTo = fmtDate(new Date())

  const sales = usePosSalesRange(appliedFrom, appliedTo)
  const recon = useReconSummary()
  const cashCount = useCashCountPending()
  const bankAccounts = useBankAccountsList(currentBranch?.company_id)
  const bankImports = useRecentBankStatementImports()
  const fiscalPeriods = useFiscalPeriodsStatus()
  const feeSummary = useFeeDiscrepancySummary(appliedFrom, appliedTo)

  const rangeData = useMemo(() =>
    sales.data?.filter(r => {
      const d = r.sales_date?.slice(0, 10)
      return d >= appliedFrom && d <= appliedTo
    }) || []
  , [sales.data, appliedFrom, appliedTo])

  const totalFee = useMemo(() => rangeData.filter(r => r.status !== 'VOID').reduce((s, r) => s + r.total_fee_amount, 0), [rangeData])
  const totalNett = useMemo(() => rangeData.filter(r => r.status !== 'VOID').reduce((s, r) => s + r.nett_amount, 0), [rangeData])
  const totalGross = useMemo(() => rangeData.filter(r => r.status !== 'VOID').reduce((s, r) => s + r.grand_total, 0), [rangeData])

  const unreconciledCount = recon.data?.unreconciled_count || 0
  const reconciledCount = recon.data?.reconciled_count || 0
  const feeDiscrepancyCount = feeSummary.data?.totalPending || recon.data?.discrepancy_count || 0

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Finance</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Gross Sales" value={sales.isLoading ? '...' : fmt(totalGross)} loading={sales.isLoading} />
        <MetricCard label="Total Fee (MDR)" value={sales.isLoading ? '...' : fmt(totalFee)} loading={sales.isLoading} color={totalFee > 0 ? 'warn' : undefined} />
        <MetricCard label="Nett Amount" value={sales.isLoading ? '...' : fmt(totalNett)} loading={sales.isLoading} />
        <MetricCard label="Cash Pending" value={cashCount.isLoading ? '...' : `${cashCount.data?.pendingCount || 0}`} loading={cashCount.isLoading} color={cashCount.data?.pendingCount ? 'warn' : undefined} />
      </div>

      {/* Recon status */}
      <div className="grid grid-cols-1 md:grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total Statement" value={recon.isLoading ? '...' : `${recon.data?.total_statements || 0}`} loading={recon.isLoading} />
        <MetricCard label="Reconciled" value={recon.isLoading ? '...' : `${reconciledCount}`} loading={recon.isLoading} />
        <MetricCard label="Belum Rekon" value={recon.isLoading ? '...' : `${unreconciledCount}`} loading={recon.isLoading} color={unreconciledCount > 0 ? 'warn' : undefined} />
        <MetricCard label="Fee Discrepancy" value={feeSummary.isLoading ? '...' : `${feeDiscrepancyCount}`} loading={feeSummary.isLoading} color={feeDiscrepancyCount > 2 ? 'danger' : feeDiscrepancyCount > 0 ? 'warn' : undefined} />
      </div>

      {/* Finance detail */}
      <FinanceOverview
        bankAccounts={bankAccounts.data}
        bankImports={bankImports.data}
        fiscalPeriods={fiscalPeriods.data}
        totalFee={totalFee}
        isLoading={bankAccounts.isLoading || fiscalPeriods.isLoading}
      />
    </div>
  )
}
