import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { useBranchContext } from '@/features/branch_context'
import {
  Activity, TrendingUp, Users, Package, Hash,
  FileSpreadsheet, ShieldCheck, Coins, DollarSign,
  ArrowRight, CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react'

import { usePosSalesRange, useReconSummary, useCashCountPending, useDashboardStats } from '@/features/dashboard/api/useDashboardApi'
import { SalesOverview } from '@/features/dashboard/components/SalesOverview'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function HomePage() {
  const { user } = useAuthStore()
  const currentBranch = useBranchContext()
  const today = fmtDate(new Date())

  const sales = usePosSalesRange(today, today)
  const recon = useReconSummary()
  const cashCount = useCashCountPending()
  const stats = useDashboardStats(currentBranch?.company_id)

  const totalSales = useMemo(() => sales.data?.reduce((s: number, r: { grand_total: number }) => s + r.grand_total, 0) || 0, [sales.data])
  const totalTrx = useMemo(() => sales.data?.reduce((s: number, r: { transaction_count: number }) => s + r.transaction_count, 0) || 0, [sales.data])
  const reconPct = recon.data && recon.data.total_statements > 0
    ? Math.round((recon.data.reconciled_count / recon.data.total_statements) * 100) : null

  // Build status items for "Status Hari Ini"
  const statusItems = useMemo(() => {
    const items: Array<{ label: string; value: string; href: string; severity: 'ok' | 'warn' | 'danger' }> = []

    if (recon.data) {
      if (recon.data.unreconciled_count > 0) {
        items.push({ label: 'Bank statement belum match', value: `${recon.data.unreconciled_count} item`, href: '/bank-reconciliation', severity: 'warn' })
      }
      if (recon.data.discrepancy_count > 0) {
        items.push({ label: 'Discrepancy ditemukan', value: `${recon.data.discrepancy_count} item`, href: '/bank-reconciliation', severity: 'danger' })
      }
    }
    if (cashCount.data && cashCount.data.pendingCount > 0) {
      items.push({ label: 'Setoran kas pending', value: `${cashCount.data.pendingCount} setoran`, href: '/cash-counts', severity: 'warn' })
    }
    return items
  }, [recon.data, cashCount.data])

  const allClear = !recon.isLoading && !cashCount.isLoading && statusItems.length === 0

  const quickActions = useMemo(() => [
    { title: 'POS Aggregates', href: '/pos-aggregates', icon: FileSpreadsheet, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { title: 'Trial Balance', href: '/accounting/trial-balance', icon: FileSpreadsheet, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
    { title: 'Cash Flow', href: '/cash-flow', icon: Activity, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { title: 'Cash Count', href: '/cash-counts', icon: Coins, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { title: 'Employees', href: '/employees', icon: Users, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { title: 'Products', href: '/products', icon: Package, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20' },
    { title: 'Pricelists', href: '/pricelists', icon: DollarSign, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20' },
    { title: 'Reconciliation', href: '/bank-reconciliation', icon: ShieldCheck, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  ], [])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 sm:p-12 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6">S</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">Suryamas</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Finance Management System</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/login" className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-center">Login</Link>
            <Link to="/register" className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold text-center">Register</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        {/* Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Halo, {user.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentBranch?.branch_name || 'No branch'} · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Penjualan Hari Ini</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {sales.isLoading ? '...' : fmt(totalSales)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Hash className="w-3.5 h-3.5 text-blue-600" />
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Transaksi</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-400">
              {sales.isLoading ? '...' : totalTrx.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-orange-600" />
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Karyawan</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {stats.isLoading ? '...' : stats.data?.employees.toLocaleString() || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="w-3.5 h-3.5 text-purple-600" />
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Produk</p>
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {stats.isLoading ? '...' : stats.data?.products.toLocaleString() || 0}
            </p>
          </div>
        </div>

        {/* Status Hari Ini */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Status Hari Ini</h3>
            {reconPct !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Rekon</span>
                <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${reconPct}%` }} />
                </div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{reconPct}%</span>
              </div>
            )}
          </div>

          {(recon.isLoading || cashCount.isLoading) ? (
            <div className="p-4 space-y-2">
              {[1, 2].map(i => <div key={i} className="h-10 bg-gray-50 dark:bg-gray-700 rounded-lg animate-pulse" />)}
            </div>
          ) : allClear ? (
            <div className="px-4 sm:px-5 py-6 flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Semua tugas harian selesai — tidak ada item pending!</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {statusItems.map((item, i) => (
                <Link key={i} to={item.href} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                  <div className={`p-1.5 rounded-lg shrink-0 ${
                    item.severity === 'danger' ? 'bg-rose-100 dark:bg-rose-900/30' :
                    item.severity === 'warn' ? 'bg-amber-100 dark:bg-amber-900/30' :
                    'bg-emerald-100 dark:bg-emerald-900/30'
                  }`}>
                    {item.severity === 'danger' ? <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" /> :
                     item.severity === 'warn' ? <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" /> :
                     <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.value}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Live Sales */}
        <SalesOverview
          data={sales.data || []}
          isLoading={sales.isLoading}
          isFetching={sales.isFetching}
          onRefresh={() => sales.refetch()}
        />

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-3">Quick Actions</h3>
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link key={action.href} to={action.href}
                  className={`${action.bg} rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center hover:shadow-md transition-all text-center`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${action.color} mb-1.5`} />
                  <span className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">{action.title}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <footer className="pt-4 pb-2 text-center text-xs text-gray-400 dark:text-gray-500">
          © {new Date().getFullYear()} CV Suryamas Pangan
        </footer>
      </div>
    </div>
  )
}
