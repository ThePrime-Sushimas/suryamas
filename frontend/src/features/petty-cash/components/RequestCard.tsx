import { PettyCashStatusBadge } from './PettyCashStatusBadge'
import type { PettyCashRequest } from '../types/pettyCash.types'
import { fmtCurrency, fmtDate } from '../utils/pettyCash.formatters'

interface RequestCardProps {
  request: PettyCashRequest
  onClick: (id: string) => void
}

export function RequestCard({ request: r, onClick }: RequestCardProps) {
  const remaining = r.total_disbursed - r.total_expenses

  return (
    <div
      onClick={() => onClick(r.id)}
      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:bg-gray-700/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900 dark:text-white">
            {r.request_number}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {r.branch_name} · {fmtDate(r.created_at)}
          </p>
        </div>
        <PettyCashStatusBadge status={r.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Diajukan</span>
          <p className="font-medium tabular-nums text-gray-900 dark:text-white">
            {fmtCurrency(r.amount_requested)}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Dicairkan</span>
          <p className="font-medium tabular-nums text-gray-900 dark:text-white">
            {fmtCurrency(r.amount_disbursed)}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Expense</span>
          <p className="tabular-nums text-gray-700 dark:text-gray-300">
            {fmtCurrency(r.total_expenses)}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Sisa</span>
          <p className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
            {fmtCurrency(remaining > 0 ? remaining : 0)}
          </p>
        </div>
      </div>
    </div>
  )
}