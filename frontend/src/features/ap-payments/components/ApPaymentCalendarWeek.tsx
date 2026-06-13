import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import type { ApDueDatePivotGroup, ApPivotLocationGrouping } from '../api/apPayments.api'
import {
  buildCalendarMonthBlocks,
  formatMonthLabel,
  getFirstDayOfMonth,
  getNullDueDateSummary,
  CALENDAR_DAY_HEADERS,
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
  locationGrouping: ApPivotLocationGrouping
  onWeekStartChange: (monday: Date) => void
  onSelectDay: (dateKey: string) => void
  onSelectNullDue: () => void
  // kept for compat but unused
  weekSpan?: number
  onWeekSpanChange?: (span: number) => void
}

function dayCellClass(
  col: { isToday: boolean; isPast: boolean },
  hasOverdue: boolean,
  isOutsideMonth: boolean,
): string {
  if (isOutsideMonth) return apTheme.calOutsideMonth
  if (hasOverdue) return apTheme.calOverdue
  if (col.isToday) return apTheme.calToday
  if (col.isPast) return apTheme.calPast
  return apTheme.calFuture
}

function DayCell({
  col,
  summary,
  isOutsideMonth,
  onSelect,
}: {
  col: CalendarDayColumn
  summary: CalendarDaySummary
  isOutsideMonth: boolean
  onSelect: (dateKey: string) => void
}) {
  const hasItems = summary.supplierCount > 0

  return (
    <button
      type="button"
      onClick={() => hasItems && !isOutsideMonth && onSelect(col.dateKey)}
      disabled={!hasItems || isOutsideMonth}
      className={`min-h-[110px] rounded-2xl p-2.5 text-left transition-all flex flex-col w-full
        ${dayCellClass(col, summary.hasOverdue, isOutsideMonth)}
        ${!hasItems ? 'cursor-default' : 'cursor-pointer'}
      `}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span
          className={`text-[10px] font-semibold ${
            isOutsideMonth
              ? 'text-rose-300/50 dark:text-gray-600'
              : col.isToday
                ? apTheme.calDayLabelToday
                : apTheme.calDayLabel
          }`}
        >
          {col.monthShort}
        </span>
        <span
          className={`text-base font-bold tabular-nums ${
            isOutsideMonth
              ? 'text-rose-300/50 dark:text-gray-600'
              : col.isToday
                ? apTheme.calDayNumToday
                : apTheme.calDayNum
          }`}
        >
          {col.dayNum}
        </span>
      </div>

      {hasItems ? (
        <div className="mt-auto space-y-1 w-full">
          <p className="text-xs font-bold text-gray-900 dark:text-white tabular-nums leading-tight">
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
  locationGrouping,
  onWeekStartChange,
  onSelectDay,
  onSelectNullDue,
}: ApPaymentCalendarWeekProps) {
  const monthStart = useMemo(() => getFirstDayOfMonth(weekStartMonday), [weekStartMonday])

  const weekBlocks = useMemo(
    () => buildCalendarMonthBlocks(monthStart, pivot),
    [monthStart, pivot],
  )

  const nullSummary = useMemo(() => getNullDueDateSummary(pivot), [pivot])
  const monthLabel = formatMonthLabel(monthStart)

  const goPrev = () => {
    const d = new Date(monthStart)
    d.setMonth(d.getMonth() - 1)
    onWeekStartChange(d)
  }

  const goNext = () => {
    const d = new Date(monthStart)
    d.setMonth(d.getMonth() + 1)
    onWeekStartChange(d)
  }

  const goToday = () => onWeekStartChange(getFirstDayOfMonth(new Date()))

  const currentMonthNum = monthStart.getMonth()

  return (
    <section className={apTheme.cardOverflow}>
      <div className={`px-5 py-4 border-b ${apTheme.divideBorder} flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <CalendarDays className={`w-5 h-5 ${apTheme.spinner}`} />
          <div>
            <h2 className={apTheme.sectionTitle}>Kalender pembayaran</h2>
            <p className={`text-xs ${apTheme.muted}`}>{monthLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className={apTheme.btnIcon}
            title="Bulan sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className={`px-3 py-2 rounded-xl text-xs font-medium border border-rose-200 dark:border-gray-600 ${apTheme.hoverRow}`}
          >
            Bulan ini
          </button>
          <button
            type="button"
            onClick={goNext}
            className={apTheme.btnIcon}
            title="Bulan berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className={apTheme.cardInset}>
          {/* Header hari */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {CALENDAR_DAY_HEADERS.map((name) => (
              <div
                key={name}
                className={`text-center text-xs font-semibold py-1 ${apTheme.calDayLabel}`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Baris minggu */}
          <div className="space-y-2">
            {weekBlocks.map((block) => (
              <div key={block.weekLabel} className="grid grid-cols-7 gap-2">
                {block.days.map((col, dayIdx) => (
                  <DayCell
                    key={col.dateKey}
                    col={col}
                    summary={block.summaries[dayIdx]}
                    isOutsideMonth={col.date.getMonth() !== currentMonthNum}
                    onSelect={onSelectDay}
                  />
                ))}
              </div>
            ))}
          </div>
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
