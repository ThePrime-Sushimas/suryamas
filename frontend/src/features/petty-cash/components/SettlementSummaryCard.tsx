import { PettyCashStatusBadge } from './PettyCashStatusBadge'
import { fmtCurrency } from '../utils/pettyCash.formatters'
import type { PettyCashExpense, PettyCashRequest } from '../types/pettyCash.types'

type SettlementSummaryCardProps = {
  request: PettyCashRequest
  remaining: number
  expenses: PettyCashExpense[]
}

export function SettlementSummaryCard({ request, remaining, expenses }: SettlementSummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {request.request_number}
        </span>
        <PettyCashStatusBadge status={request.status} />
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Total Dicairkan</span>
          <p className="font-medium">
            {fmtCurrency(request.total_disbursed)}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Total Expense</span>
          <p className="font-medium">{fmtCurrency(request.total_expenses)}</p>
        </div>
        <div>
          <span className="text-gray-500">Saldo Tersisa</span>
          <p className="font-semibold text-blue-600">
            {fmtCurrency(remaining)}
          </p>
        </div>
      </div>

      {expenses.length > 0 && (
        <details className="pt-2">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Lihat {expenses.length} expense
          </summary>
          <div className="mt-2 max-h-40 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-gray-50 dark:border-gray-700/50"
                  >
                    <td className="py-1 text-gray-600">
                      <div>{e.product_name}</div>
                      {e.category_name && (
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                          {e.category_name}
                        </div>
                      )}
                    </td>
                    <td className="py-1 text-right font-medium">
                      {fmtCurrency(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
