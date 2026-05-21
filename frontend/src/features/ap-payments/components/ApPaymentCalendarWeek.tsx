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
import { apTheme } from '../ap-payments.theme'

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
  if (hasOverdue) return apTheme.calOverdue
  if (col.isToday) return apTheme.calToday
  if (col.isPast) return apTheme.calPast
  return apTheme.calFuture
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
      className={`${minH} rounded-2xl p-3 text-left transition-all flex flex-col w-full ${dayCellClass(col, summary.hasOverdue)} ${!hasItems ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span
          className={`text-xs font-semibold ${col.isToday ? apTheme.calDayLabelToday : apTheme.calDayLabel}`}
        >
          {col.dayName}
        </span>
        <span
          className={`text-base font-bold tabular-nums ${col.isToday ? apTheme.calDayNumToday : apTheme.calDayNum}`}
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
    <section className={apTheme.cardOverflow}>
      <div className={`px-5 py-4 border-b ${apTheme.divideBorder} flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <CalendarDays className={`w-5 h-5 ${apTheme.spinner}`} />
          <div>
            <h2 className={apTheme.sectionTitle}>
              Kalender pembayaran
            </h2>
            <p className={`text-xs ${apTheme.muted}`}>
              {rangeLabel} · {weekSpan * 7} hari (baris {weekSpan}×7)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={weekSpan}
            onChange={(e) => onWeekSpanChange(Number(e.target.value) as CalendarWeekSpan)}
            className={`text-xs rounded-xl px-3 py-2 ${apTheme.select}`}
          >
            <option value={1}>7 hari (1 minggu)</option>
            <option value={2}>14 hari (2 minggu)</option>
            <option value={4}>28 hari (4 minggu)</option>
          </select>
          <button
            type="button"
            onClick={goPrev}
            className={apTheme.btnIcon}
            title="Periode sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className={`px-3 py-2 rounded-xl text-xs font-medium border border-rose-200 dark:border-gray-600 ${apTheme.hoverRow}`}
          >
            Minggu ini
          </button>
          <button
            type="button"
            onClick={goNext}
            className={apTheme.btnIcon}
            title="Periode berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className={apTheme.cardInset}>
          <div className="grid grid-cols-7 gap-2 mb-3">
            {CALENDAR_DAY_HEADERS.map((name) => (
              <div
                key={name}
                className={`text-center text-xs font-semibold py-1 ${apTheme.calDayLabel}`}
              >
                {name}
              </div>
            ))}
          </div>

        {weekBlocks.map((block, blockIdx) => (
          <div key={block.weekLabel} className="space-y-2">
            {weekSpan > 1 && (
              <p className={`text-xs font-medium px-0.5 ${apTheme.muted}`}>
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
      </div>

      {nullSummary && (
        <div className={`px-5 py-4 border-t ${apTheme.divideBorder}`}>
          <button
            type="button"
            onClick={onSelectNullDue}
            className={`w-full flex items-center justify-between gap-3 p-4 text-left ${apTheme.cardInnerDashed}`}
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

      <p className={`px-5 py-3 text-[10px] border-t ${apTheme.divideBorder} ${apTheme.muted}`}>
        Tampilan lokasi:{' '}
        {locationGrouping === 'branch' ? 'per cabang' : 'per rek (PT/CV)'} · Klik hari untuk
        detail rekening dari / ke
      </p>
    </section>
  )
}
