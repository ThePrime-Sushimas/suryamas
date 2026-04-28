import { useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)

const fmtCompact = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`
  return String(n)
}

const dayLabel = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

interface SalesRow { sales_date: string; grand_total: number; transaction_count: number }
interface Props { data: SalesRow[]; isLoading: boolean }

function niceMax(val: number): number {
  if (val <= 0) return 1_000_000
  const mag = Math.pow(10, Math.floor(Math.log10(val)))
  const norm = val / mag
  if (norm <= 1) return mag
  if (norm <= 1.2) return 1.2 * mag
  if (norm <= 1.5) return 1.5 * mag
  if (norm <= 2) return 2 * mag
  if (norm <= 3) return 3 * mag
  if (norm <= 5) return 5 * mag
  if (norm <= 7) return 7 * mag
  return 10 * mag
}

const CHART_H = 140

interface TooltipData { x: number; y: number; date: string; total: number; trx: number }

export function DailySalesChart({ data, isLoading }: Props) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const showTooltip = useCallback((e: React.MouseEvent, d: { date: string; total: number; trx: number }) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 4, date: d.date, total: d.total, trx: d.trx })
  }, [])

  const hideTooltip = useCallback(() => setTooltip(null), [])

  const daily = useMemo(() => {
    const map = new Map<string, { total: number; trx: number }>()
    for (const row of data) {
      const date = row.sales_date?.slice(0, 10)
      if (!date) continue
      const e = map.get(date)
      if (e) { e.total += row.grand_total; e.trx += row.transaction_count }
      else map.set(date, { total: row.grand_total, trx: row.transaction_count })
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }))
  }, [data])

  const ceilMax = useMemo(() => {
    const rawMax = Math.max(...daily.map((d) => d.total), 1)
    return niceMax(rawMax * 1.15)
  }, [daily])
  const yTicks = useMemo(() => [0, Math.round(ceilMax / 2), ceilMax], [ceilMax])

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="p-3">
          <div className="rounded animate-pulse bg-gray-50 dark:bg-gray-700/30" style={{ height: CHART_H }} />
        </div>
      </div>
    )
  }

  if (daily.length === 0) return null

  const todayIso = new Date().toISOString().slice(0, 10)
  const barCount = daily.length
  const showAllLabels = barCount <= 10
  const showEveryN = barCount <= 20 ? 2 : barCount <= 31 ? 5 : 7

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Penjualan Harian</span>
        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{daily.length} hari</span>
      </div>

      <div className="px-3 pt-2 pb-2">
        <div className="flex">
          {/* Y-axis */}
          <div className="flex flex-col justify-between shrink-0 pr-1.5" style={{ height: CHART_H }}>
            {[...yTicks].reverse().map((tick) => (
              <span key={tick} className="text-[9px] text-gray-400 dark:text-gray-500 text-right leading-none" style={{ minWidth: 32 }}>
                {fmtCompact(tick)}
              </span>
            ))}
          </div>

          {/* Chart + X-axis */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Bar area — absolute positioned bars from bottom */}
            <div className="relative" style={{ height: CHART_H }}>
              {/* Gridlines */}
              {yTicks.map((tick) => (
                <div key={tick} className="absolute left-0 right-0 border-t border-dashed border-gray-100 dark:border-gray-700/60" style={{ bottom: `${(tick / ceilMax) * 100}%` }} />
              ))}

              {/* Bars — each absolutely positioned, bottom: 0 */}
              <div className="absolute inset-0 flex gap-0.5 z-10">
                {daily.map((d) => {
                  const pct = Math.max((d.total / ceilMax) * 100, 1)
                  const isToday = d.date === todayIso
                  return (
                    <div
                      key={d.date}
                      className="flex-1 relative"
                      onMouseEnter={(e) => showTooltip(e, d)}
                      onMouseLeave={hideTooltip}
                    >
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-t cursor-default transition-colors duration-150 ${
                          isToday
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : 'bg-emerald-200 dark:bg-emerald-700 hover:bg-emerald-400 dark:hover:bg-emerald-500'
                        }`}
                        style={{ height: `${pct}%`, minHeight: 2 }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* X-axis labels */}
            <div className="flex gap-0.5 mt-1">
              {daily.map((d, i) => {
                const isToday = d.date === todayIso
                const showLabel = showAllLabels || i % showEveryN === 0 || i === barCount - 1 || isToday
                return (
                  <div key={d.date} className="flex-1 text-center">
                    <span className={`text-[8px] whitespace-nowrap ${isToday ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-400 dark:text-gray-500'} ${showLabel ? '' : 'invisible'}`}>
                      {dayLabel(d.date)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 flex-wrap">
          <span>Total <span className="font-semibold text-gray-700 dark:text-gray-300">{fmt(daily.reduce((s, d) => s + d.total, 0))}</span></span>
          <span>Avg <span className="font-semibold text-gray-700 dark:text-gray-300">{fmt(daily.reduce((s, d) => s + d.total, 0) / daily.length)}</span>/hari</span>
          <span className="ml-auto flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500 dark:bg-emerald-400" />Hari ini</span>
        </div>
      </div>

      {/* Portal tooltip */}
      {tooltip && createPortal(
        <div
          className="fixed pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
        >
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[9px] rounded-md px-2.5 py-1.5 shadow-xl whitespace-nowrap">
            <p className="font-semibold text-[10px]">{dayLabel(tooltip.date)}</p>
            <p>{fmt(tooltip.total)} · {tooltip.trx} trx</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
