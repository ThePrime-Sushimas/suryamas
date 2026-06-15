import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import type { WasteRecord, WasteSource } from '../api/wasteReport.api'

export interface TrendPoint {
  label: string
  date_key: string
  total_cost: number
  total_qty: number
  count: number
  by_source: Record<WasteSource, number>
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des']

function emptyBySource(): Record<WasteSource, number> {
  return {
    GOODS_PROCESSING: 0,
    STOCK_ADJUSTMENT: 0,
    PRODUCTION_ORDER: 0,
    DAILY_OPNAME: 0,
  }
}

function recordDateKey(date: string): string {
  return date.includes('T') ? date.slice(0, 10) : date.slice(0, 10)
}

function formatDailyLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return dateKey
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

function isoWeekKey(dateKey: string): string {
  const dt = parseISO(`${dateKey}T12:00:00`)
  const year = getISOWeekYear(dt)
  const week = getISOWeek(dt)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function formatWeeklyLabel(weekKey: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey)
  if (!match) return weekKey
  return `Minggu ${Number(match[2])}`
}

function aggregate(
  records: WasteRecord[],
  bucketKey: (dateKey: string) => string,
  labelFn: (key: string) => string,
): TrendPoint[] {
  const map = new Map<string, TrendPoint>()

  for (const r of records) {
    const dk = recordDateKey(r.date)
    const key = bucketKey(dk)
    let point = map.get(key)
    if (!point) {
      point = {
        label: labelFn(key),
        date_key: key,
        total_cost: 0,
        total_qty: 0,
        count: 0,
        by_source: emptyBySource(),
      }
      map.set(key, point)
    }
    point.total_cost += r.total_cost
    point.total_qty += r.qty
    point.count += 1
    point.by_source[r.source] += r.total_cost
  }

  return [...map.values()].sort((a, b) => a.date_key.localeCompare(b.date_key))
}

export function aggregateTrendDaily(records: WasteRecord[]): TrendPoint[] {
  return aggregate(records, (dk) => dk, formatDailyLabel)
}

export function aggregateTrendWeekly(records: WasteRecord[]): TrendPoint[] {
  return aggregate(records, isoWeekKey, formatWeeklyLabel)
}

/** Flatten TrendPoint[] into recharts row shape with source keys + totals */
export function trendPointsToChartRows(
  points: TrendPoint[],
  stacked: boolean,
): Record<string, string | number>[] {
  return points.map((p) => {
    const row: Record<string, string | number> = {
      label: p.label,
      date_key: p.date_key,
      total_cost: p.total_cost,
      total_qty: p.total_qty,
      count: p.count,
    }
    if (stacked) {
      row.GOODS_PROCESSING = p.by_source.GOODS_PROCESSING
      row.STOCK_ADJUSTMENT = p.by_source.STOCK_ADJUSTMENT
      row.PRODUCTION_ORDER = p.by_source.PRODUCTION_ORDER
      row.DAILY_OPNAME = p.by_source.DAILY_OPNAME
    }
    return row
  })
}

export function filterPeriodDays(startDate: string, endDate: string): number {
  const start = parseISO(`${startDate}T00:00:00`)
  const end = parseISO(`${endDate}T00:00:00`)
  return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
}
