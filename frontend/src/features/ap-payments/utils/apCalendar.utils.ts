import type { ApDueDatePivotGroup, ApDueDatePivotRow } from '../api/apPayments.api'

export type CalendarWeekSpan = 1 | 2 | 4

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const

export interface CalendarDayColumn {
  dateKey: string
  date: Date
  dayName: string
  dayNum: number
  monthShort: string
  isToday: boolean
  isPast: boolean
}

export interface CalendarDaySummary {
  dateKey: string
  totalOutstanding: number
  invoiceCount: number
  supplierCount: number
  hasOverdue: boolean
  hasReadyToPay: boolean
  topRows: ApDueDatePivotRow[]
  allRows: ApDueDatePivotRow[]
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setHours(0, 0, 0, 0)
  return date
}

/** Senin sebagai awal minggu (ISO-style week start) */
export function getMondayOfWeek(ref: Date): Date {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

export function buildCalendarDays(
  weekStartMonday: Date,
  weekSpan: CalendarWeekSpan,
): CalendarDayColumn[] {
  const todayKey = toDateKey(new Date())
  const totalDays = weekSpan * 7
  const days: CalendarDayColumn[] = []

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(weekStartMonday, i)
    const dateKey = toDateKey(date)
    days.push({
      dateKey,
      date,
      dayName: DAY_NAMES[i % 7],
      dayNum: date.getDate(),
      monthShort: date.toLocaleDateString('id-ID', { month: 'short' }),
      isToday: dateKey === todayKey,
      isPast: dateKey < todayKey,
    })
  }

  return days
}

export function formatWeekRangeLabel(
  weekStartMonday: Date,
  weekSpan: CalendarWeekSpan,
): string {
  const end = addDays(weekStartMonday, weekSpan * 7 - 1)
  const fmt = (d: Date) =>
    d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(weekStartMonday)} – ${fmt(end)}`
}

export function formatSingleWeekLabel(weekStartMonday: Date): string {
  const end = addDays(weekStartMonday, 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(weekStartMonday)} – ${fmt(end)}`
}

export interface CalendarWeekBlock {
  weekStart: Date
  weekLabel: string
  days: CalendarDayColumn[]
  summaries: CalendarDaySummary[]
}

/** Satu baris = 7 hari (Sen–Min), beberapa minggu ditumpuk ke bawah */
export function buildCalendarWeekBlocks(
  weekStartMonday: Date,
  weekSpan: CalendarWeekSpan,
  pivot: ApDueDatePivotGroup[],
): CalendarWeekBlock[] {
  const dayColumns = buildCalendarDays(weekStartMonday, weekSpan)
  const summaries = buildCalendarDaySummaries(pivot, dayColumns)
  const blocks: CalendarWeekBlock[] = []

  for (let w = 0; w < weekSpan; w++) {
    const start = w * 7
    const weekStart = addDays(weekStartMonday, start)
    blocks.push({
      weekStart,
      weekLabel: formatSingleWeekLabel(weekStart),
      days: dayColumns.slice(start, start + 7),
      summaries: summaries.slice(start, start + 7),
    })
  }

  return blocks
}

export const CALENDAR_DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const

export function flattenPivotRows(pivot: ApDueDatePivotGroup[]): ApDueDatePivotRow[] {
  return pivot.flatMap((g) => g.rows)
}

export function buildRowsByDueDate(
  rows: ApDueDatePivotRow[],
): Map<string, ApDueDatePivotRow[]> {
  const map = new Map<string, ApDueDatePivotRow[]>()
  for (const row of rows) {
    const key = row.due_date ?? '__null__'
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return map
}

export function summarizeDay(rows: ApDueDatePivotRow[]): Omit<
  CalendarDaySummary,
  'dateKey'
> {
  const supplierIds = new Set<string>()
  let totalOutstanding = 0
  let invoiceCount = 0
  let hasOverdue = false
  let hasReadyToPay = false

  for (const row of rows) {
    supplierIds.add(row.supplier_id)
    totalOutstanding += row.outstanding
    invoiceCount += row.invoice_count
    if (row.is_overdue) hasOverdue = true
    if (row.can_pay) hasReadyToPay = true
  }

  const sorted = [...rows].sort((a, b) => b.outstanding - a.outstanding)

  return {
    totalOutstanding,
    invoiceCount,
    supplierCount: supplierIds.size,
    hasOverdue,
    hasReadyToPay,
    topRows: sorted.slice(0, 3),
    allRows: sorted,
  }
}

export function buildCalendarDaySummaries(
  pivot: ApDueDatePivotGroup[],
  dayColumns: CalendarDayColumn[],
): CalendarDaySummary[] {
  const byDate = buildRowsByDueDate(flattenPivotRows(pivot))

  return dayColumns.map((col) => {
    const allRows = byDate.get(col.dateKey) ?? []
    return {
      dateKey: col.dateKey,
      ...summarizeDay(allRows),
    }
  })
}

/** Tanggal 1 dari bulan yang mengandung ref */
export function getFirstDayOfMonth(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatMonthLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

/**
 * Bangun baris minggu untuk satu bulan (kalender grid standar).
 * Baris pertama bisa berisi hari-hari dari bulan sebelumnya (padding).
 * Baris terakhir bisa berisi hari-hari dari bulan berikutnya.
 */
export function buildCalendarMonthBlocks(
  monthStart: Date,
  pivot: ApDueDatePivotGroup[],
): CalendarWeekBlock[] {
  const todayKey = toDateKey(new Date())

  // Hari pertama bulan ini jatuh di hari ke-N (0=Min, 1=Sen, ...)
  // Kita pakai Senin sebagai kolom pertama (ISO)
  const firstDow = monthStart.getDay() // 0=Min
  const paddingDays = firstDow === 0 ? 6 : firstDow - 1 // berapa hari dari bulan lalu

  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((paddingDays + daysInMonth) / 7) * 7

  const allDays: CalendarDayColumn[] = []
  for (let i = 0; i < totalCells; i++) {
    const date = addDays(new Date(year, month, 1 - paddingDays), i)
    const dateKey = toDateKey(date)
    const dow = date.getDay()
    allDays.push({
      dateKey,
      date,
      dayName: DAY_NAMES[dow === 0 ? 6 : dow - 1],
      dayNum: date.getDate(),
      monthShort: date.toLocaleDateString('id-ID', { month: 'short' }),
      isToday: dateKey === todayKey,
      isPast: dateKey < todayKey,
    })
  }

  const summaries = buildCalendarDaySummaries(pivot, allDays)
  const blocks: CalendarWeekBlock[] = []
  for (let w = 0; w < totalCells / 7; w++) {
    const start = w * 7
    const weekStart = allDays[start].date
    blocks.push({
      weekStart,
      weekLabel: formatSingleWeekLabel(weekStart),
      days: allDays.slice(start, start + 7),
      summaries: summaries.slice(start, start + 7),
    })
  }
  return blocks
}

export function getNullDueDateSummary(
  pivot: ApDueDatePivotGroup[],
): CalendarDaySummary | null {
  const group = pivot.find((g) => g.due_date === null)
  if (!group || group.rows.length === 0) return null
  return {
    dateKey: '__null__',
    ...summarizeDay(group.rows),
  }
}

export function formatDayTitle(dateKey: string): string {
  if (dateKey === '__null__') return 'Tanpa jatuh tempo'
  const d = parseDateKey(dateKey)
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
