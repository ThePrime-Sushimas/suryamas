import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WasteRecord, WasteSource } from '../api/wasteReport.api'
import {
  aggregateTrendDaily,
  aggregateTrendWeekly,
  filterPeriodDays,
  trendPointsToChartRows,
  type TrendPoint,
} from '../utils/aggregateTrend'
import { formatChartAxisRp } from '../utils/chartAxisFormat'
import { EmptyState } from './EmptyState'
import { fmt, fmtRp, SOURCE_LABELS, SOURCE_CHART_COLORS } from './wasteReport.constants'

function TrendTooltipContent({
  active,
  payload,
  point,
  stacked,
}: {
  active?: boolean
  payload?: readonly { name?: unknown; value?: unknown; color?: string }[]
  point?: TrendPoint
  stacked: boolean
}) {
  if (!active || !point) return null

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg px-3 py-2.5 text-xs min-w-[180px]">
      <p className="font-semibold text-gray-900 dark:text-white mb-2">{point.label}</p>
      <p className="text-gray-600 dark:text-gray-300">Nilai: {fmtRp(point.total_cost)}</p>
      <p className="text-gray-600 dark:text-gray-300">Qty: {fmt(point.total_qty)}</p>
      <p className="text-gray-600 dark:text-gray-300">Transaksi: {fmt(point.count)}</p>
      {stacked && payload && payload.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
          {payload
            .filter((p) => Number(p.value) > 0)
            .map((p) => (
              <p key={String(p.name)} className="text-gray-500 dark:text-gray-400">
                {String(p.name)}: {fmtRp(Number(p.value))}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}

export function WasteTrendChart({
  records,
  startDate,
  endDate,
}: {
  records: WasteRecord[]
  startDate: string
  endDate: string
}) {
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily')
  const [stacked, setStacked] = useState(true)

  useEffect(() => {
    const days = filterPeriodDays(startDate, endDate)
    setGranularity(days > 60 ? 'weekly' : 'daily')
  }, [startDate, endDate])

  const trendPoints = useMemo(() => {
    return granularity === 'weekly'
      ? aggregateTrendWeekly(records)
      : aggregateTrendDaily(records)
  }, [records, granularity])

  const chartData = useMemo(
    () => trendPointsToChartRows(trendPoints, stacked),
    [trendPoints, stacked],
  )

  if (trendPoints.length === 0) {
    return (
      <EmptyState message="Tidak ada trend waste pada periode ini — tidak ada transaksi dengan nilai waste." />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Trend Nilai Waste</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Agregasi dari {records.length} transaksi · periode {granularity === 'weekly' ? 'mingguan' : 'harian'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-900/50">
            {(['daily', 'weekly'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  granularity === g
                    ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {g === 'daily' ? 'Harian' : 'Mingguan'}
              </button>
            ))}
          </div>
          <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-900/50">
            <button
              type="button"
              onClick={() => setStacked(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                !stacked
                  ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Gabung
            </button>
            <button
              type="button"
              onClick={() => setStacked(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                stacked
                  ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Per Sumber
            </button>
          </div>
        </div>
      </div>

      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="text-gray-500"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={formatChartAxisRp}
              className="text-gray-500"
            />
            <Tooltip
              content={({ active, payload, label }) => (
                <TrendTooltipContent
                  active={active}
                  payload={payload}
                  point={trendPoints.find(
                    (p) => p.label === (typeof label === 'string' ? label : String(label ?? '')),
                  )}
                  stacked={stacked}
                />
              )}
            />
            {stacked ? (
              <>
                {(Object.keys(SOURCE_LABELS) as WasteSource[]).map((s) => (
                  <Bar
                    key={s}
                    dataKey={s}
                    name={SOURCE_LABELS[s]}
                    stackId="waste"
                    fill={SOURCE_CHART_COLORS[s]}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </>
            ) : (
              <Bar dataKey="total_cost" name="Total Nilai" fill="#dc2626" radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
