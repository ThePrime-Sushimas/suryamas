import { formatCurrency } from '../../shared/journal.utils'
import type { JournalBalance } from '../../shared/journal.types'

interface BalanceIndicatorProps {
  balance: JournalBalance
  currency?: string
  className?: string
}

export const BalanceIndicator = ({ balance, currency = 'IDR', className = '' }: BalanceIndicatorProps) => {
  return (
    <div className={`bg-gray-50 p-4 rounded-lg border ${balance.is_balanced ? 'border-green-200' : 'border-red-200'} ${className}`}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-600">Total Debit</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(balance.total_debit, currency)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Total Credit</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(balance.total_credit, currency)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Balance</p>
          <p className={`text-lg font-semibold ${balance.is_balanced ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(Math.abs(balance.balance), currency)}
            {balance.is_balanced && ' ✓'}
          </p>
        </div>
      </div>
      {!balance.is_balanced && (
        <p className="mt-2 text-sm text-red-600">
          ⚠️ Journal is not balanced. Total debit must equal total credit.
        </p>
      )}
    </div>
  )
}
