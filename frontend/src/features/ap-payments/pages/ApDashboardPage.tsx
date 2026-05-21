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
import { ApPaymentsShell } from '../components/ApPaymentsShell'
import { apTheme } from '../ap-payments.theme'

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
      ? apTheme.metricWarn
      : tone === 'ok'
        ? apTheme.metricOk
        : tone === 'muted'
          ? apTheme.metricMuted
          : apTheme.metricDefault

  return (
    <div className={`rounded-2xl border p-5 ${toneCls}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${apTheme.label}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-rose-950 dark:text-rose-50 tabular-nums">{value}</p>
      {sub && <p className={`mt-1 text-xs ${apTheme.muted}`}>{sub}</p>}
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
    <ApPaymentsShell>
      <div className={`${apTheme.header} px-4 sm:px-6 py-5`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={apTheme.headerIcon}>
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className={apTheme.title}>AP Dashboard</h1>
              <p className={apTheme.subtitle}>
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
              className={apTheme.btnSecondary}
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
            <Link
              to={AP_PAYMENTS_LIST_PATH}
              className={apTheme.btnSecondary}
            >
              <List className="w-4 h-4" />
              Daftar pembayaran
            </Link>
            {canInsert && (
              <Link
                to={`${AP_PAYMENTS_LIST_PATH}/new`}
                className={apTheme.btnPrimary}
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
            <Loader2 className={`w-8 h-8 animate-spin ${apTheme.spinner}`} />
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

            <section className={`${apTheme.card} p-5`}>
              <h2 className={`${apTheme.sectionTitle} mb-4`}>
                Aging (semua outstanding)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {agingTotals.map((bucket) => (
                  <div
                    key={bucket.bucket}
                    className={`p-4 rounded-2xl ${apTheme.cardInner}`}
                  >
                    <p className={apTheme.label}>{bucket.label}</p>
                    <p className="mt-1 text-sm font-bold text-rose-950 dark:text-rose-50 tabular-nums">
                      {fmt(bucket.amount)}
                    </p>
                    <p className={`text-xs mt-0.5 ${apTheme.muted}`}>{bucket.invoice_count} invoice</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className={apTheme.tabsWrap}>
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
                  className={dashboardView === id ? apTheme.tabActive : apTheme.tabInactive}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
            {(dashboardView === 'calendar' || dashboardView === 'planning') && (
              <div className={apTheme.pillBorderWrap}>
                <button
                  type="button"
                  onClick={() => setLocationGrouping('branch')}
                  className={
                    locationGrouping === 'branch' ? apTheme.pillActive : apTheme.pillInactive
                  }
                >
                  Per cabang
                </button>
                <button
                  type="button"
                  onClick={() => setLocationGrouping('entity')}
                  className={
                    locationGrouping === 'entity' ? apTheme.pillActive : apTheme.pillInactive
                  }
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
              <p className={`text-sm text-center py-8 ${apTheme.muted}`}>
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
            <section className={apTheme.cardOverflow}>
              <div className={`px-5 py-4 border-b ${apTheme.divideBorder} flex items-center justify-between`}>
                <h2 className={apTheme.sectionTitle}>
                  Per supplier
                </h2>
                <span className={`text-xs ${apTheme.muted}`}>{suppliers.length} supplier</span>
              </div>

              {suppliers.length === 0 ? (
                <p className={`px-5 py-12 text-center text-sm ${apTheme.muted}`}>
                  Tidak ada hutang outstanding saat ini.
                </p>
              ) : (
                <div className={`divide-y ${apTheme.divide}`}>
                  {suppliers.map((s) => {
                    const open = expandedSupplier === s.supplier_id
                    return (
                      <div key={s.supplier_id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSupplier(open ? null : s.supplier_id)
                          }
                          className={`w-full px-5 py-4 flex items-center gap-4 text-left ${apTheme.hoverRow}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-rose-950 dark:text-rose-50 truncate">
                              {s.supplier_name}
                              {s.supplier_code && (
                                <span className="ml-2 text-xs font-normal text-gray-400">
                                  {s.supplier_code}
                                </span>
                              )}
                            </p>
                            <div className={`mt-1 flex flex-wrap gap-3 text-xs ${apTheme.muted}`}>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Menunggu post: {fmt(s.pending_post_amount)} ({s.pending_post_count})
                              </span>
                              <span className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-300">
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
                            <p className="text-sm font-bold text-rose-950 dark:text-rose-50 tabular-nums">
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
                                className={`px-3 py-2 rounded-xl ${apTheme.cardInner} text-xs`}
                              >
                                <p className={apTheme.muted}>{b.label}</p>
                                <p className="font-medium text-rose-900 dark:text-rose-100">
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

            <p className={`text-xs text-center ${apTheme.muted}`}>
              PI <strong>APPROVED</strong> → draft AP otomatis. Pembayaran (PAID) hanya setelah PI{' '}
              <strong>POSTED</strong> (jurnal hutang terbentuk).
            </p>
          </>
        )}
      </div>
    </ApPaymentsShell>
  )
}
