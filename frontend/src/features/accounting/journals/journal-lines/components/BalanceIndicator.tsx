import { formatCurrency } from '../../shared/journal.utils'
import type { JournalBalance } from '../../shared/journal.types'

interface BalanceIndicatorProps {
  balance: JournalBalance
  currency?: string
  className?: string
}

export const BalanceIndicator = ({ balance, currency = 'IDR', className = '' }: BalanceIndicatorProps) => {
  return (
    <div className={`bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border ${balance.is_balanced ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'} ${className}`}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Debit</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(balance.total_debit, currency)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Credit</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(balance.total_credit, currency)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Balance</p>
          <p className={`text-lg font-semibold ${balance.is_balanced ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(Math.abs(balance.balance), currency)}
            {balance.is_balanced && ' ✓'}
          </p>
        </div>
      </div>
      {!balance.is_balanced && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          ⚠️ Journal is not balanced. Total debit must equal total credit.
        </p>
      )}
    </div>
  )
}

