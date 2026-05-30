import type { OpnameSummary } from '../types'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)

interface OpnameSummaryCardProps {
  summary: OpnameSummary
}

export function OpnameSummaryCard({ summary }: OpnameSummaryCardProps) {
  const completionPct = Math.round(summary.completion_pct)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Expected Cost */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <p className="text-xs text-gray-400">Total Expected</p>
        <p className="text-lg font-bold text-gray-700 dark:text-gray-200">
          {fmtCurrency(summary.total_expected_cost)}
        </p>
      </div>

      {/* Total Actual Cost */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <p className="text-xs text-gray-400">Total Actual</p>
        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
          {fmtCurrency(summary.total_actual_cost)}
        </p>
      </div>

      {/* Total Variance Cost */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <p className="text-xs text-gray-400">Total Variance</p>
        <p
          className={`text-lg font-bold ${
            summary.total_variance_cost < 0
              ? 'text-red-600 dark:text-red-400'
              : summary.total_variance_cost > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-700 dark:text-gray-200'
          }`}
        >
          {fmtCurrency(summary.total_variance_cost)}
        </p>
      </div>

      {/* Completion */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <p className="text-xs text-gray-400">Completion</p>
        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
          {completionPct}%
        </p>
        <div className="mt-1.5 w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(completionPct, 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {summary.completed_count}/{summary.line_count} item
        </p>
      </div>
    </div>
  )
}
