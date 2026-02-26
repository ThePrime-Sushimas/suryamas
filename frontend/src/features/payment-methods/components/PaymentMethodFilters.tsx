import { usePaymentMethodsStore } from '../store/paymentMethods.store'
import type { PaymentType } from '../types'

const PAYMENT_TYPE_OPTIONS: { value: PaymentType | undefined; label: string }[] = [
  { value: undefined, label: 'All Types' },
  { value: 'BANK', label: 'Bank' },
  { value: 'CARD', label: 'Card' },
  { value: 'CASH', label: 'Cash' },
  { value: 'COMPLIMENT', label: 'Compliment' },
  { value: 'MEMBER_DEPOSIT', label: 'Member Deposit' },
  { value: 'OTHER_COST', label: 'Other Cost' }
]

export const PaymentMethodFilters = () => {
  const { filter, setFilter, clearFilter } = usePaymentMethodsStore()

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4 border border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Search code or name..."
            value={filter.q || ''}
            onChange={(e) => setFilter({ q: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Payment Type */}
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Payment Type
          </label>
          <select
            value={filter.payment_type || ''}
            onChange={(e) => setFilter({ payment_type: e.target.value as PaymentType || undefined })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {PAYMENT_TYPE_OPTIONS.map(option => (
              <option key={option.value || 'all'} value={option.value || ''}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Active Status */}
        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={filter.is_active === undefined ? '' : filter.is_active.toString()}
            onChange={(e) => {
              const value = e.target.value
              setFilter({ is_active: value === '' ? undefined : value === 'true' })
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {/* Requires Bank Account */}
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Requires Bank Account
          </label>
          <select
            value={filter.requires_bank_account === undefined ? '' : filter.requires_bank_account.toString()}
            onChange={(e) => {
              const value = e.target.value
              setFilter({ requires_bank_account: value === '' ? undefined : value === 'true' })
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        {/* Clear Filters */}
        <button
          onClick={clearFilter}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Clear Filters
        </button>
      </div>
    </div>
  )
}
