import { usePaymentMethodsStore } from '../store/paymentMethods.store'
import type { PaymentType } from '../types'

const PAYMENT_TYPE_OPTIONS: { value: PaymentType | undefined; label: string }[] = [
  { value: undefined, label: 'All Types' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'GIRO', label: 'Giro' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'DIGITAL_WALLET', label: 'Digital Wallet' },
  { value: 'OTHER', label: 'Other' }
]

export const PaymentMethodFilters = () => {
  const { filter, setFilter, clearFilter } = usePaymentMethodsStore()

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Search code or name..."
            value={filter.q || ''}
            onChange={(e) => setFilter({ q: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Payment Type */}
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Type
          </label>
          <select
            value={filter.payment_type || ''}
            onChange={(e) => setFilter({ payment_type: e.target.value as PaymentType || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filter.is_active === undefined ? '' : filter.is_active.toString()}
            onChange={(e) => {
              const value = e.target.value
              setFilter({ is_active: value === '' ? undefined : value === 'true' })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {/* Requires Bank Account */}
        <div className="w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Requires Bank Account
          </label>
          <select
            value={filter.requires_bank_account === undefined ? '' : filter.requires_bank_account.toString()}
            onChange={(e) => {
              const value = e.target.value
              setFilter({ requires_bank_account: value === '' ? undefined : value === 'true' })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        {/* Clear Filters */}
        <button
          onClick={clearFilter}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Clear Filters
        </button>
      </div>
    </div>
  )
}

