import { useMemo, useState } from 'react'
import { ChevronDown, Play, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { useUrlFilters } from '@/lib/urlFilters'
import { useAmortizations, useExecuteAmortization, useAmortizationSchedulerLastRun } from '../api/generalApi.api'
import type { AmortizationItem, AmortizationEntry } from '../api/generalApi.api'
import { formatRupiah, formatDate } from '../constants'
import { useToast } from '@/contexts/ToastContext'
import {
  amortizationFilterUtils,
  type AmortizationFilters,
} from '../utils/amortizationFilters.url'

// ─── Helpers ───────────────────────────────────────────────────

function computeStats(items: AmortizationItem[]) {
  let totalPrepaid = 0
  let totalAmortized = 0
  let totalRemaining = 0
  let overdueCount = 0
  const today = new Date().toISOString().slice(0, 10)

  for (const a of items) {
    totalPrepaid += a.total_amount
    totalAmortized += a.amount_per_period * a.periods_executed
    totalRemaining += a.total_amount - a.amount_per_period * a.periods_executed

    for (const e of a.entries) {
      if (!e.journal_id && e.period_date <= today) overdueCount++
    }
  }

  return { totalPrepaid, totalAmortized, totalRemaining, overdueCount }
}

/**
 * Group consecutive executed entries into a collapsed range, then show overdue
 * and up to MAX_PENDING_VISIBLE pending entries individually. Remaining pending
 * entries are summarized as "+ N periode lagi".
 *
 * Assumption: entries sorted by period_number means executed entries come first
 * (earlier dates), then overdue (past date, not executed), then future pending.
 * This holds because period_date increases monotonically with period_number.
 *
 * Note: we sort defensively here even though backend guarantees ORDER BY,
 * because this is a pure helper that could receive data from any source
 * (e.g. unit tests, optimistic updates).
 */
function groupEntries(entries: AmortizationEntry[]) {
  const today = new Date().toISOString().slice(0, 10)
  const sorted = [...entries].sort((a, b) => a.period_number - b.period_number)

  type GroupedEntry =
    | { type: 'done-range'; from: number; to: number; dateFrom: string; dateTo: string; amount: number; count: number }
    | { type: 'single'; entry: AmortizationEntry; isOverdue: boolean; isExecuted: boolean }
    | { type: 'remaining'; count: number; dateFrom: string; dateTo: string }

  const result: GroupedEntry[] = []
  let doneBuffer: AmortizationEntry[] = []

  const flushDone = () => {
    if (doneBuffer.length === 0) return
    if (doneBuffer.length === 1) {
      result.push({ type: 'single', entry: doneBuffer[0], isOverdue: false, isExecuted: true })
    } else {
      result.push({
        type: 'done-range',
        from: doneBuffer[0].period_number,
        to: doneBuffer[doneBuffer.length - 1].period_number,
        dateFrom: doneBuffer[0].period_date,
        dateTo: doneBuffer[doneBuffer.length - 1].period_date,
        amount: doneBuffer[0].amount,
        count: doneBuffer.length,
      })
    }
    doneBuffer = []
  }

  // Show all overdue entries + at most N future pending entries individually
  const MAX_PENDING_VISIBLE = 2
  let pendingShown = 0
  const hiddenEntries: AmortizationEntry[] = []

  for (const entry of sorted) {
    const isExecuted = !!entry.journal_id
    const isOverdue = !isExecuted && entry.period_date <= today

    if (isExecuted) {
      doneBuffer.push(entry)
    } else {
      flushDone()
      if (isOverdue || pendingShown < MAX_PENDING_VISIBLE) {
        result.push({ type: 'single', entry, isOverdue, isExecuted: false })
        if (!isOverdue) pendingShown++
      } else {
        hiddenEntries.push(entry)
      }
    }
  }
  flushDone()

  // Append summary for hidden entries
  if (hiddenEntries.length > 0) {
    result.push({
      type: 'remaining',
      count: hiddenEntries.length,
      dateFrom: hiddenEntries[0].period_date,
      dateTo: hiddenEntries[hiddenEntries.length - 1].period_date,
    })
  }

  return result
}

function formatMonthRange(from: string, to: string) {
  const f = new Date(from)
  const t = new Date(to)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const fYear = f.getFullYear()
  const tYear = t.getFullYear()
  if (fYear === tYear) {
    return `${months[f.getMonth()]}–${months[t.getMonth()]} ${fYear}`
  }
  return `${months[f.getMonth()]} ${fYear}–${months[t.getMonth()]} ${tYear}`
}

// ─── Components ─────────────────────────────────────────────────

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-5 py-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-semibold ${warn ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────

type StatusTab = AmortizationFilters['status']
const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: '', label: 'Semua' },
]

export default function AmortizationsPage() {
  const toast = useToast()
  const { filters, setFilters } = useUrlFilters<AmortizationFilters>(amortizationFilterUtils)

  const { data: amortizations = [], isLoading } = useAmortizations({
    status: filters.status || undefined,
  })

  const executeMutation = useExecuteAmortization()
  const { data: lastRun } = useAmortizationSchedulerLastRun()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExecute = (amort: AmortizationItem, entry: AmortizationEntry) => {
    if (entry.journal_id) return
    // onError already handled in useExecuteAmortization hook — use mutate (fire-and-forget)
    executeMutation.mutate(
      { id: amort.id, period_number: entry.period_number },
      { onSuccess: () => toast.success(`Amortisasi periode ${entry.period_number} berhasil dieksekusi`) },
    )
  }

  const stats = useMemo(() => computeStats(amortizations), [amortizations])

  const today = new Date().toISOString().slice(0, 10)

  // Find the next unexecuted entry for quick-execute on row level.
  // Entries are sorted by period_number (backend guarantees order via ORDER BY).
  const getNextEntry = (amort: AmortizationItem): AmortizationEntry | null => {
    return amort.entries.find((e) => !e.journal_id) ?? null
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Amortisasi Prepaid</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Jadwal amortisasi dari invoice prepaid — eksekusi per periode untuk membuat jurnal beban
        </p>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3">
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilters({ status: tab.value })}
              className={`px-3.5 py-1.5 text-xs rounded-md transition-colors ${
                filters.status === tab.value
                  ? 'bg-white text-gray-900 font-medium shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-1">
          {amortizations.length} jadwal ditemukan
        </span>

        {/* Scheduler last-run badge */}
        {lastRun && (
          <div className="ml-auto flex items-center gap-2">
            {lastRun.has_data_anomaly && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-red-100 text-red-800 font-medium"
                title="Terdeteksi orphaned journal — ada inkonsistensi data yang perlu investigasi manual"
              >
                <AlertTriangle size={11} />
                Perlu review manual
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] ${
                lastRun.status === 'SUCCESS'
                  ? 'bg-green-50 text-green-700'
                  : lastRun.status === 'PARTIAL'
                    ? 'bg-amber-50 text-amber-700'
                    : lastRun.status === 'FAILED'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-gray-100 text-gray-500'
              }`}
              title={`Trigger: ${lastRun.trigger} · ${lastRun.success_count}/${lastRun.total_entries} berhasil`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                lastRun.status === 'SUCCESS' ? 'bg-green-500' :
                lastRun.status === 'PARTIAL' ? 'bg-amber-500' :
                lastRun.status === 'FAILED' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              Auto-run {lastRun.run_month}: {lastRun.status === 'SUCCESS' ? 'OK' : lastRun.status}
              {lastRun.finished_at && (
                <span className="text-[10px] opacity-70 ml-1">
                  ({formatDate(lastRun.finished_at)})
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-200">
        <StatCard label="Total nilai prepaid" value={formatRupiah(stats.totalPrepaid)} />
        <StatCard label="Sudah diamortisasi" value={formatRupiah(stats.totalAmortized)} />
        <StatCard label="Sisa nilai" value={formatRupiah(stats.totalRemaining)} />
        <StatCard
          label="Periode terlambat"
          value={`${stats.overdueCount} periode`}
          warn={stats.overdueCount > 0}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Memuat...</div>
        ) : amortizations.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Belum ada jadwal amortisasi.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-8 pl-4 pr-0" />
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Vendor / Invoice
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Akun
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Total
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Progress
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Jatuh tempo berikut
                </th>
                <th className="text-right px-4 pr-6 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {amortizations.map((amort) => {
                const isExpanded = expandedIds.has(amort.id)
                const nextEntry = getNextEntry(amort)
                const nextIsOverdue = nextEntry ? nextEntry.period_date <= today : false
                const progressPct = Math.round((amort.periods_executed / amort.total_periods) * 100)

                return (
                  <TableRow
                    key={amort.id}
                    amort={amort}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(amort.id)}
                    nextEntry={nextEntry}
                    nextIsOverdue={nextIsOverdue}
                    progressPct={progressPct}
                    onExecute={handleExecute}
                    isPending={executeMutation.isPending}
                  />
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Table Row ──────────────────────────────────────────────────

function TableRow({
  amort,
  isExpanded,
  onToggle,
  nextEntry,
  nextIsOverdue,
  progressPct,
  onExecute,
  isPending,
}: {
  amort: AmortizationItem
  isExpanded: boolean
  onToggle: () => void
  nextEntry: AmortizationEntry | null
  nextIsOverdue: boolean
  progressPct: number
  onExecute: (amort: AmortizationItem, entry: AmortizationEntry) => void
  isPending: boolean
}) {
  const grouped = useMemo(() => groupEntries(amort.entries), [amort.entries])

  return (
    <>
      {/* Main row */}
      <tr
        className={`cursor-pointer transition-colors hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''}`}
        onClick={onToggle}
      >
        <td className="pl-4 pr-0 py-3">
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-gray-900">{amort.vendor_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{amort.invoice_number}</p>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700">
              {amort.prepaid_account_code}
            </span>
            <span className="text-[10px] text-gray-400">→</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-green-50 text-green-700">
              {amort.expense_account_code}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 font-medium text-gray-900 tabular-nums">
          {formatRupiah(amort.total_amount)}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
              <div
                className={`h-full rounded-full ${amort.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className={`text-xs tabular-nums ${amort.status === 'COMPLETED' ? 'text-green-600' : 'text-gray-500'}`}>
              {amort.periods_executed}/{amort.total_periods}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
              amort.status === 'ACTIVE'
                ? 'bg-amber-100 text-amber-700'
                : amort.status === 'COMPLETED'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {amort.status === 'ACTIVE' ? 'Aktif' : amort.status === 'COMPLETED' ? 'Selesai' : 'Dibatalkan'}
          </span>
        </td>
        <td className="px-4 py-3">
          {nextEntry ? (
            <span className={`text-xs ${nextIsOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
              {nextIsOverdue && <AlertTriangle size={12} className="inline -mt-0.5 mr-1" />}
              {formatDate(nextEntry.period_date)}
            </span>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
        <td className="px-4 pr-6 py-3 text-right">
          {nextEntry && amort.status === 'ACTIVE' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onExecute(amort, nextEntry)
              }}
              disabled={isPending}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors disabled:opacity-50 ${
                nextIsOverdue
                  ? 'border-red-300 text-red-700 hover:bg-red-50'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Play size={10} /> Eksekusi
            </button>
          ) : amort.status === 'COMPLETED' ? (
            <span className="text-xs text-gray-400">Lunas</span>
          ) : null}
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-0 py-0">
            <div className="pl-14 pr-6 pb-4 pt-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Periode</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Tanggal</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Jumlah</th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Status</th>
                    <th className="text-right py-2 font-medium text-gray-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grouped.map((g, idx) => {
                    if (g.type === 'done-range') {
                      return (
                        <tr key={`range-${idx}`}>
                          <td className="py-2 pr-4 text-gray-500">
                            Periode {g.from}–{g.to}
                          </td>
                          <td className="py-2 pr-4 text-gray-500">
                            {formatMonthRange(g.dateFrom, g.dateTo)}
                          </td>
                          <td className="py-2 pr-4 tabular-nums text-gray-500">
                            {formatRupiah(g.amount)} &times;{g.count}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              <span className="text-green-700">Selesai semua</span>
                            </span>
                          </td>
                          <td className="py-2 text-right text-gray-400">—</td>
                        </tr>
                      )
                    }

                    if (g.type === 'remaining') {
                      return (
                        <tr key={`remaining-${idx}`}>
                          <td colSpan={5} className="py-2 text-gray-400">
                            + {g.count} periode lagi ({formatMonthRange(g.dateFrom, g.dateTo)})
                          </td>
                        </tr>
                      )
                    }

                    // type === 'single'
                    const { entry, isOverdue, isExecuted } = g
                    return (
                      <tr
                        key={entry.id}
                        className={isOverdue ? 'bg-red-50/50' : ''}
                      >
                        <td className="py-2 pr-4 text-gray-500">
                          Periode {entry.period_number}
                        </td>
                        <td className={`py-2 pr-4 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                          {formatDate(entry.period_date)}
                        </td>
                        <td className="py-2 pr-4 tabular-nums text-gray-700">
                          {formatRupiah(entry.amount)}
                        </td>
                        <td className="py-2 pr-4">
                          {isExecuted ? (
                            <span className="inline-flex items-center gap-1.5">
                              <CheckCircle2 size={12} className="text-green-500" />
                              <span className="text-green-700">
                                Dieksekusi {entry.executed_at ? formatDate(entry.executed_at) : ''}
                              </span>
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1.5">
                              <AlertTriangle size={12} className="text-red-500" />
                              <span className="text-red-600">Terlambat</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock size={12} className="text-gray-400" />
                              <span className="text-gray-500">Menunggu</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {!isExecuted ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onExecute(amort, entry)
                              }}
                              disabled={isPending}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border transition-colors disabled:opacity-50 ${
                                isOverdue
                                  ? 'border-red-300 text-red-700 hover:bg-red-50'
                                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              <Play size={9} /> Eksekusi
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
