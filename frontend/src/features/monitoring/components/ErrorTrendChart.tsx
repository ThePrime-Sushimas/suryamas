import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { monitoringApi } from '../api/monitoring.api'

interface TrendDay {
  date: string
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

const CHART_H = 120

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export function ErrorTrendChart() {
  const { data = [], isLoading: loading } = useQuery<TrendDay[]>({
    queryKey: ['monitoring', 'error-trend', 30],
    queryFn: () => monitoringApi.getErrorTrend(30),
    staleTime: 60_000,
  })

  const maxVal = useMemo(() => Math.max(...data.map(d => d.total), 1), [data])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
        <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
        <div className="rounded animate-pulse bg-gray-50 dark:bg-gray-700/30" style={{ height: CHART_H }} />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">Tidak ada error dalam 30 hari terakhir 🎉</p>
      </div>
    )
  }

  const barCount = data.length
  const showEveryN = barCount <= 10 ? 1 : barCount <= 20 ? 3 : 5

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Error Trend (30 hari)</span>
        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{data.reduce((s, d) => s + d.total, 0)} total</span>
      </div>
      <div className="p-4">
        <div className="relative" style={{ height: CHART_H }}>
          <div className="absolute inset-0 flex gap-0.5">
            {data.map((d) => {
              const totalH = (d.total / maxVal) * CHART_H
              const critH = d.total > 0 ? (d.critical / d.total) * totalH : 0
              const highH = d.total > 0 ? (d.high / d.total) * totalH : 0
              const medH = d.total > 0 ? (d.medium / d.total) * totalH : 0
              const lowH = d.total > 0 ? (d.low / d.total) * totalH : 0
              return (
                <div key={d.date} className="flex-1 relative group" title={`${dayLabel(d.date)}: ${d.total} errors`}>
                  <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse">
                    {d.low > 0 && <div className="bg-sky-300 dark:bg-sky-600" style={{ height: `${lowH}px` }} />}
                    {d.medium > 0 && <div className="bg-violet-400 dark:bg-violet-500" style={{ height: `${medH}px` }} />}
                    {d.high > 0 && <div className="bg-rose-400 dark:bg-rose-500" style={{ height: `${highH}px` }} />}
                    {d.critical > 0 && <div className="bg-red-700 dark:bg-red-600" style={{ height: `${critH}px` }} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {/* X-axis */}
        <div className="flex gap-0.5 mt-1">
          {data.map((d, i) => (
            <div key={d.date} className="flex-1 text-center">
              <span className={`text-[8px] whitespace-nowrap text-gray-400 dark:text-gray-500 ${i % showEveryN === 0 || i === barCount - 1 ? '' : 'invisible'}`}>
                {dayLabel(d.date)}
              </span>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-700" />Critical</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-400" />High</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-400" />Medium</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-300" />Low</span>
        </div>
      </div>
    </div>
  )
}
