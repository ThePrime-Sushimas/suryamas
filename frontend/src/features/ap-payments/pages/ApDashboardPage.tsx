import { useEffect, useMemo, useState } from 'react'
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
  Download,
  CalendarDays,
  LayoutList,
  Users,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  useApDashboard,
  type ApPivotLocationGrouping,
} from '../api/apPayments.api'
import { ApDueDatePivotSection } from '../components/ApDueDatePivotSection'
import { ApPaymentCalendarWeek } from '../components/ApPaymentCalendarWeek'
import { ApPaymentDayDetailDrawer } from '../components/ApPaymentDayDetailDrawer'
import { exportApDashboardExcel } from '../utils/apDashboardExport'
import { getMondayOfWeek, summarizeDay } from '../utils/apCalendar.utils'
import type { CalendarWeekSpan } from '../utils/apCalendar.utils'
import { AP_PAYMENTS_LIST_PATH } from '../constants'

type DashboardView = 'calendar' | 'planning' | 'suppliers'

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

function todayKeyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ApDashboardPage() {
  const toast = useToast()
  const branch = useBranchContextStore((s) => s.currentBranch)
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canInsert = hasPermission('ap_payments', 'insert')

  const { data, isLoading, isError } = useApDashboard(branch?.branch_id)
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [showBankInfo, setShowBankInfo] = useState(true)
  const [locationGrouping, setLocationGrouping] =
    useState<ApPivotLocationGrouping>('branch')
  const [dashboardView, setDashboardView] = useState<DashboardView>('calendar')
  const [weekStartMonday, setWeekStartMonday] = useState(() =>
    getMondayOfWeek(new Date()),
  )
  const [weekSpan, setWeekSpan] = useState<CalendarWeekSpan>(1)
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)

  const summary = data?.summary
  const suppliers = data?.suppliers ?? []
  const agingTotals = data?.aging_totals ?? []
  const dueDatePivot = data?.due_date_pivot ?? []

  useEffect(() => {
    if (!data?.due_date_pivot?.length) return
    const today = todayKeyLocal()
    const keys = data.due_date_pivot
      .filter(
        (g) =>
          g.is_overdue ||
          g.is_today ||
          !g.due_date ||
          (g.due_date && g.due_date <= today),
      )
      .map((g) => g.due_date ?? '__null__')
    setExpandedDates(new Set(keys))
  }, [data?.due_date_pivot])

  const selectedDayRows = useMemo(() => {
    if (!selectedDayKey || !dueDatePivot.length) return []
    if (selectedDayKey === '__null__') {
      const g = dueDatePivot.find((x) => x.due_date === null)
      return g?.rows ?? []
    }
    const g = dueDatePivot.find((x) => x.due_date === selectedDayKey)
    return g?.rows ?? []
  }, [selectedDayKey, dueDatePivot])

  const selectedDaySummary = useMemo(() => {
    if (!selectedDayKey) return null
    return summarizeDay(selectedDayRows)
  }, [selectedDayKey, selectedDayRows])

  const handleExport = () => {
    if (!data?.due_date_pivot?.length) {
      toast.error('Tidak ada data untuk di-export')
      return
    }
    try {
      exportApDashboardExcel(data, locationGrouping)
      toast.success('Excel berhasil diunduh')
    } catch {
      toast.error('Gagal export Excel')
    }
  }

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
            <button
              type="button"
              onClick={handleExport}
              disabled={!data || isLoading || dueDatePivot.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
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

      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
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

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap gap-2 p-1 rounded-2xl bg-gray-100 dark:bg-gray-800/80 w-fit">
              {(
                [
                  { id: 'calendar' as const, label: 'Kalender', icon: CalendarDays },
                  { id: 'planning' as const, label: 'Planning list', icon: LayoutList },
                  { id: 'suppliers' as const, label: 'Per supplier', icon: Users },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDashboardView(id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    dashboardView === id
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
            {(dashboardView === 'calendar' || dashboardView === 'planning') && (
              <div className="inline-flex rounded-2xl border border-gray-200 dark:border-gray-600 p-0.5">
                <button
                  type="button"
                  onClick={() => setLocationGrouping('branch')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                    locationGrouping === 'branch'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600'
                  }`}
                >
                  Per cabang
                </button>
                <button
                  type="button"
                  onClick={() => setLocationGrouping('entity')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                    locationGrouping === 'entity'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600'
                  }`}
                >
                  Per rek (PT/CV)
                </button>
              </div>
            )}
            </div>

            {dashboardView === 'calendar' && dueDatePivot.length > 0 && (
              <ApPaymentCalendarWeek
                pivot={dueDatePivot}
                weekStartMonday={weekStartMonday}
                weekSpan={weekSpan}
                locationGrouping={locationGrouping}
                onWeekStartChange={setWeekStartMonday}
                onWeekSpanChange={setWeekSpan}
                onSelectDay={(key) => setSelectedDayKey(key)}
                onSelectNullDue={() => setSelectedDayKey('__null__')}
              />
            )}

            {dashboardView === 'calendar' && dueDatePivot.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                Tidak ada jadwal pembayaran untuk ditampilkan di kalender.
              </p>
            )}

            {dashboardView === 'planning' && dueDatePivot.length > 0 && (
              <ApDueDatePivotSection
                pivot={dueDatePivot}
                expandedDates={expandedDates}
                onToggleDate={(key) =>
                  setExpandedDates((prev) => {
                    const next = new Set(prev)
                    if (next.has(key)) next.delete(key)
                    else next.add(key)
                    return next
                  })
                }
                showBankInfo={showBankInfo}
                onToggleBankInfo={() => setShowBankInfo((v) => !v)}
                locationGrouping={locationGrouping}
                onLocationGroupingChange={setLocationGrouping}
              />
            )}

            {dashboardView === 'suppliers' && (
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
            )}

            <ApPaymentDayDetailDrawer
              isOpen={!!selectedDayKey}
              dateKey={selectedDayKey}
              rows={selectedDayRows}
              totalOutstanding={selectedDaySummary?.totalOutstanding ?? 0}
              invoiceCount={selectedDaySummary?.invoiceCount ?? 0}
              locationGrouping={locationGrouping}
              onClose={() => setSelectedDayKey(null)}
            />

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
