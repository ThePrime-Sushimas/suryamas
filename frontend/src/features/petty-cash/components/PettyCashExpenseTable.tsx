import { Receipt } from 'lucide-react'
import type { PettyCashExpense, PettyCashRequestStatus } from '../types/pettyCash.types'
import { ExpenseTableDesktop } from './ExpenseTableDesktop'
import { ExpenseCardList } from './ExpenseCardList'

interface PettyCashExpenseTableProps {
  expenses: PettyCashExpense[]
  requestStatus: PettyCashRequestStatus
  onEdit: (expense: PettyCashExpense) => void
  onDelete: (expenseId: string) => void
}

const CARD_SHELL =
  'overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800'

export function PettyCashExpenseTable({
  expenses,
  requestStatus,
  onEdit,
  onDelete,
}: PettyCashExpenseTableProps) {
  const canAct = requestStatus === 'DISBURSED'

  return (
    <div className={CARD_SHELL}>
      <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Pengeluaran</h3>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {expenses.length} item tercatat
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700/50">
            <Receipt className="h-6 w-6 text-gray-400" />
          </div>
          <p className="font-medium text-gray-900 dark:text-white">Belum ada pengeluaran</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tambahkan expense saat request dalam status aktif (dicairkan).
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <ExpenseTableDesktop
              expenses={expenses}
              canAct={canAct}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
          <div className="md:hidden">
            <ExpenseCardList
              expenses={expenses}
              canAct={canAct}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </>
      )}
    </div>
  )
}
