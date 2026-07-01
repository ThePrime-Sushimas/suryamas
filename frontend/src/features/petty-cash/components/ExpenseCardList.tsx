import { ExpenseCard } from './ExpenseCard'
import type { PettyCashExpense } from '../types/pettyCash.types'
import { fmtCurrency } from '@/lib/formatters'

interface ExpenseCardListProps {
  expenses: PettyCashExpense[]
  canAct: boolean
  onEdit: (expense: PettyCashExpense) => void
  onDelete: (expenseId: string) => void
}

export function ExpenseCardList({ expenses, canAct, onEdit, onDelete }: ExpenseCardListProps) {
  return (
    <div className="space-y-3 p-4">
      {expenses.map((e) => (
        <ExpenseCard key={e.id} expense={e} canAct={canAct} onEdit={onEdit} onDelete={onDelete} />
      ))}

      {expenses.length > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium dark:border-gray-700 dark:bg-gray-700/30">
          <span className="text-gray-600 dark:text-gray-300">Total Keseluruhan</span>
          <span className="tabular-nums text-gray-900 dark:text-white">
            {fmtCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
          </span>
        </div>
      )}
    </div>
  )
}