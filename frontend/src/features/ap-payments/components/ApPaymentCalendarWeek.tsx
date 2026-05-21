import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import type { ApDueDatePivotGroup, ApPivotLocationGrouping } from '../api/apPayments.api'
import {
  buildCalendarWeekBlocks,
  formatWeekRangeLabel,
  getMondayOfWeek,
  getNullDueDateSummary,
  CALENDAR_DAY_HEADERS,
  type CalendarWeekSpan,
  type CalendarDayColumn,
  type CalendarDaySummary,
} from '../utils/apCalendar.utils'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

interface ApPaymentCalendarWeekProps {
  pivot: ApDueDatePivotGroup[]
  weekStartMonday: Date
  weekSpan: CalendarWeekSpan
  locationGrouping: ApPivotLocationGrouping
  onWeekStartChange: (monday: Date) => void
  onWeekSpanChange: (span: CalendarWeekSpan) => void
  onSelectDay: (dateKey: string) => void
  onSelectNullDue: () => void
}

function dayCellClass(col: { isToday: boolean; isPast: boolean }, hasOverdue: boolean): string {
  if (hasOverdue) {
    return 'border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-900/25'
  }
  if (col.isToday) {
    return 'border-blue-400 dark:border-blue-600 bg-blue-50/90 dark:bg-blue-900/25 ring-1 ring-blue-200 dark:ring-blue-800'
  }
  if (col.isPast) {
    return 'border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50'
  }
  return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
}

function DayCell({
  col,
  summary,
  compact,
  onSelect,
}: {
  col: CalendarDayColumn
  summary: CalendarDaySummary
  compact: boolean
  onSelect: (dateKey: string) => void
}) {
  const hasItems = summary.supplierCount > 0
  const minH = compact ? 'min-h-[100px]' : 'min-h-[140px]'

  return (
    <button
      type="button"
      onClick={() => hasItems && onSelect(col.dateKey)}
      disabled={!hasItems}
      className={`${minH} rounded-2xl border p-3 text-left transition-colors flex flex-col w-full ${dayCellClass(col, summary.hasOverdue)} ${!hasItems ? 'opacity-60 cursor-default' : 'cursor-pointer hover:shadow-sm'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span
          className={`text-xs font-semibold ${col.isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500'}`}
        >
          {col.dayName}
        </span>
        <span
          className={`text-base font-bold tabular-nums ${col.isToday ? 'text-blue-800 dark:text-blue-200' : 'text-gray-900 dark:text-white'}`}
        >
          {col.dayNum}
        </span>
      </div>
      <span className="text-[10px] text-gray-400 mb-2">{col.monthShort}</span>

      {hasItems ? (
        <div className="mt-auto space-y-1.5 w-full">
          <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums leading-tight">
            {fmt(summary.totalOutstanding)}
          </p>
          <p className="text-[10px] text-gray-500">
            {summary.supplierCount} supp · {summary.invoiceCount} inv
          </p>
          <div className="space-y-0.5">
            {summary.topRows.map((row) => (
              <p
                key={`${row.supplier_id}-${row.branch_id}`}
                className="text-[10px] text-gray-600 dark:text-gray-400 truncate"
              >
                {row.supplier_name}
              </p>
            ))}
            {summary.supplierCount > 3 && (
              <p className="text-[10px] text-gray-400">+{summary.supplierCount - 3} lainnya</p>
            )}
          </div>
          {summary.hasReadyToPay && (
            <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Siap bayar
            </span>
          )}
        </div>
      ) : (
        <p className="mt-auto text-[10px] text-gray-400">—</p>
      )}
    </button>
  )
}

export function ApPaymentCalendarWeek({
  pivot,
  weekStartMonday,
  weekSpan,
  locationGrouping,
  onWeekStartChange,
  onWeekSpanChange,
  onSelectDay,
  onSelectNullDue,
}: ApPaymentCalendarWeekProps) {
  const weekBlocks = useMemo(
    () => buildCalendarWeekBlocks(weekStartMonday, weekSpan, pivot),
    [weekStartMonday, weekSpan, pivot],
  )

  const nullSummary = useMemo(() => getNullDueDateSummary(pivot), [pivot])
  const rangeLabel = formatWeekRangeLabel(weekStartMonday, weekSpan)
  const compact = weekSpan > 1

  const shiftDays = weekSpan * 7

  const goPrev = () => {
    const d = new Date(weekStartMonday)
    d.setDate(d.getDate() - shiftDays)
    onWeekStartChange(d)
  }

  const goNext = () => {
    const d = new Date(weekStartMonday)
    d.setDate(d.getDate() + shiftDays)
    onWeekStartChange(d)
  }

  const goToday = () => onWeekStartChange(getMondayOfWeek(new Date()))

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Kalender pembayaran
            </h2>
            <p className="text-xs text-gray-500">
              {rangeLabel} · {weekSpan * 7} hari (baris {weekSpan}×7)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={weekSpan}
            onChange={(e) => onWeekSpanChange(Number(e.target.value) as CalendarWeekSpan)}
            className="text-xs rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
          >
            <option value={1}>7 hari (1 minggu)</option>
            <option value={2}>14 hari (2 minggu)</option>
            <option value={4}>28 hari (4 minggu)</option>
          </select>
          <button
            type="button"
            onClick={goPrev}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Periode sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Minggu ini
          </button>
          <button
            type="button"
            onClick={goNext}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="Periode berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        <div className="grid grid-cols-7 gap-2">
          {CALENDAR_DAY_HEADERS.map((name) => (
            <div
              key={name}
              className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-1"
            >
              {name}
            </div>
          ))}
        </div>

        {weekBlocks.map((block, blockIdx) => (
          <div key={block.weekLabel} className="space-y-2">
            {weekSpan > 1 && (
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 px-0.5">
                Minggu {blockIdx + 1} · {block.weekLabel}
              </p>
            )}
            <div className="grid grid-cols-7 gap-2 sm:gap-3">
              {block.days.map((col, dayIdx) => (
                <DayCell
                  key={col.dateKey}
                  col={col}
                  summary={block.summaries[dayIdx]}
                  compact={compact}
                  onSelect={onSelectDay}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {nullSummary && (
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onSelectNullDue}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 text-left"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Tanpa jatuh tempo
              </p>
              <p className="text-xs text-gray-500">
                {nullSummary.supplierCount} supplier · {nullSummary.invoiceCount} invoice
              </p>
            </div>
            <p className="text-sm font-bold tabular-nums">{fmt(nullSummary.totalOutstanding)}</p>
          </button>
        </div>
      )}

      <p className="px-5 py-3 text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-700">
        Tampilan lokasi:{' '}
        {locationGrouping === 'branch' ? 'per cabang' : 'per rek (PT/CV)'} · Klik hari untuk
        detail rekening dari / ke
      </p>
    </section>
  )
}
