import { useQuery } from '@tanstack/react-query'
import { monitoringApi } from '../api/monitoring.api'
import { Repeat } from 'lucide-react'

interface GroupedError {
  error_name: string
  error_message: string
  module: string
  severity: string
  count: number
  last_seen: string
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function ErrorGroupedList() {
  const { data = [], isLoading: loading } = useQuery({
    queryKey: ['monitoring', 'error-grouped'],
    queryFn: () => monitoringApi.getErrorGrouped(30),
    staleTime: 60_000,
  })

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
        <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-50 dark:bg-gray-700/30 rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">Tidak ada error yang tercatat</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Repeat className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recurring Errors</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-80 overflow-y-auto">
        {data.map((err, i) => (
          <div key={i} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SEVERITY_COLORS[err.severity] || SEVERITY_COLORS.LOW}`}>
                    {err.severity}
                  </span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{err.module}</span>
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{err.error_name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{err.error_message}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{err.count}×</p>
                <p className="text-[10px] text-gray-400">{timeAgo(err.last_seen)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
