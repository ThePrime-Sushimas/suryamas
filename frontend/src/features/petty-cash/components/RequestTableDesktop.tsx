import { Trash2 } from 'lucide-react'
import { PettyCashStatusBadge } from './PettyCashStatusBadge'
import type { PettyCashRequest } from '../types/pettyCash.types'
import { fmtCurrency, fmtDate } from '@/lib/formatters'

interface RequestTableDesktopProps {
  rows: PettyCashRequest[]
  onRowClick: (id: string) => void
  onDelete?: (id: string) => void
}

export function RequestTableDesktop({ rows, onRowClick, onDelete }: RequestTableDesktopProps) {
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
            {onDelete && (
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Aksi
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {rows.map((r) => {
            const remaining = r.total_disbursed - r.total_expenses
            const canDelete = (r.status === 'PENDING' || r.status === 'REJECTED')
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
                {onDelete && canDelete && (
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(r.id) }}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      title="Hapus request"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
                {onDelete && !canDelete && (
                  <td className="px-4 py-3 text-center" />
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
