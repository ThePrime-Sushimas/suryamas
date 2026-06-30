import { PettyCashStatusBadge } from './PettyCashStatusBadge'
import type { PettyCashRequest } from '../types/pettyCash.types'
import { fmtCurrency, fmtDate } from '../utils/pettyCash.formatters'

interface RequestTableDesktopProps {
  rows: PettyCashRequest[]
  onRowClick: (id: string) => void
}

export function RequestTableDesktop({ rows, onRowClick }: RequestTableDesktopProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-700/30">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              No. Request
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Cabang
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Tgl Dibuat
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Diajukan
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Dicairkan
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Expense
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Sisa
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {rows.map((r) => {
            const remaining = r.total_disbursed - r.total_expenses
            return (
              <tr
                key={r.id}
                onClick={() => onRowClick(r.id)}
                className="cursor-pointer transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-700/25"
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {r.request_number}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.branch_name}</td>
                <td className="px-4 py-3">
                  <PettyCashStatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {fmtDate(r.created_at)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {fmtCurrency(r.amount_requested)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {fmtCurrency(r.amount_disbursed)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {fmtCurrency(r.total_expenses)}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900 dark:text-white">
                  {fmtCurrency(remaining > 0 ? remaining : 0)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}