import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet,
  Clock,
  AlertTriangle,
  CheckCircle2,
  List,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useApDashboard } from '../api/apPayments.api'
import { AP_DASHBOARD_PATH, AP_PAYMENTS_LIST_PATH } from '../constants'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'warn' | 'ok' | 'muted'
}) {
  const toneCls =
    tone === 'warn'
      ? 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20'
      : tone === 'ok'
        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-900/20'
        : tone === 'muted'
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneCls}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

export default function ApDashboardPage() {
  const branch = useBranchContextStore((s) => s.currentBranch)
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('ap_payments', 'insert')

  const { data, isLoading, isError } = useApDashboard(branch?.branch_id)
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)

  const summary = data?.summary
  const suppliers = data?.suppliers ?? []
  const agingTotals = data?.aging_totals ?? []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AP Dashboard</h1>
              <p className="text-sm text-gray-500">
                Outstanding hutang per supplier
                {branch?.branch_name ? ` · ${branch.branch_name}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={AP_PAYMENTS_LIST_PATH}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <List className="w-4 h-4" />
              Daftar pembayaran
            </Link>
            {canInsert && (
              <Link
                to={`${AP_PAYMENTS_LIST_PATH}/new`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Buat pembayaran
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-5 text-sm text-red-700 dark:text-red-300">
            Gagal memuat dashboard. Periksa koneksi atau permission modul AP Payments.
          </div>
        )}

        {!isLoading && data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total outstanding"
                value={fmt(summary?.total_outstanding ?? 0)}
                sub={`${summary?.supplier_count ?? 0} supplier`}
              />
              <MetricCard
                label="Menunggu posting PI"
                value={fmt(summary?.pending_post_amount ?? 0)}
                sub={`${summary?.pending_post_count ?? 0} invoice · draft AP otomatis`}
                tone="muted"
              />
              <MetricCard
                label="Siap dibayar"
                value={fmt(summary?.ready_to_pay_amount ?? 0)}
                sub={`${summary?.ready_to_pay_count ?? 0} invoice · PI sudah POSTED`}
                tone="ok"
              />
              <MetricCard
                label="Overdue"
                value={fmt(summary?.overdue_amount ?? 0)}
                tone={(summary?.overdue_amount ?? 0) > 0 ? 'warn' : 'default'}
              />
            </div>

            <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Aging (semua outstanding)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {agingTotals.map((bucket) => (
                  <div
                    key={bucket.bucket}
                    className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700"
                  >
                    <p className="text-xs text-gray-500">{bucket.label}</p>
                    <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                      {fmt(bucket.amount)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{bucket.invoice_count} invoice</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Per supplier
                </h2>
                <span className="text-xs text-gray-500">{suppliers.length} supplier</span>
              </div>

              {suppliers.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-gray-500">
                  Tidak ada hutang outstanding saat ini.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {suppliers.map((s) => {
                    const open = expandedSupplier === s.supplier_id
                    return (
                      <div key={s.supplier_id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSupplier(open ? null : s.supplier_id)
                          }
                          className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">
                              {s.supplier_name}
                              {s.supplier_code && (
                                <span className="ml-2 text-xs font-normal text-gray-400">
                                  {s.supplier_code}
                                </span>
                              )}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Menunggu post: {fmt(s.pending_post_amount)} ({s.pending_post_count})
                              </span>
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Siap bayar: {fmt(s.ready_to_pay_amount)} ({s.ready_to_pay_count})
                              </span>
                              {s.overdue_amount > 0 && (
                                <span className="inline-flex items-center gap-1 text-amber-600">
                                  <AlertTriangle className="w-3 h-3" />
                                  Overdue: {fmt(s.overdue_amount)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                              {fmt(s.total_outstanding)}
                            </p>
                            {open ? (
                              <ChevronUp className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                            )}
                          </div>
                        </button>
                        {open && (
                          <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {s.aging.map((b) => (
                              <div
                                key={b.bucket}
                                className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-xs"
                              >
                                <p className="text-gray-500">{b.label}</p>
                                <p className="font-medium text-gray-800 dark:text-gray-200">
                                  {fmt(b.amount)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <p className="text-xs text-gray-500 text-center">
              PI <strong>APPROVED</strong> → draft AP otomatis. Pembayaran (PAID) hanya setelah PI{' '}
              <strong>POSTED</strong> (jurnal hutang terbentuk).
            </p>
          </>
        )}
      </div>
    </div>
  )
}
