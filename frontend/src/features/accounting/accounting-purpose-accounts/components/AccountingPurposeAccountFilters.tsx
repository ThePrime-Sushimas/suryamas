import { useMemo } from 'react'
import type { AccountingPurposeAccountFilter, Side, AccountType } from '../types/accounting-purpose-account.types'
import { SIDES, ACCOUNT_TYPES } from '../constants/accounting-purpose-account.constants'
import { useAccountingPurposeAccountsStore } from '../store/accountingPurposeAccounts.store'

interface AccountingPurposeAccountFiltersProps {
  filter: AccountingPurposeAccountFilter
  onFilterChange: (filter: AccountingPurposeAccountFilter) => void
}

export const AccountingPurposeAccountFilters = ({ filter, onFilterChange }: AccountingPurposeAccountFiltersProps) => {
  const { activePurposes } = useAccountingPurposeAccountsStore()

  const purposeOptions = useMemo(() => 
    activePurposes.map(p => ({ value: p.id, label: `${p.purpose_code} - ${p.purpose_name}` })),
    [activePurposes]
  )

  const sideOptions = SIDES.map(s => ({ value: s, label: s }))
  const accountTypeOptions = ACCOUNT_TYPES.map(t => ({ value: t, label: t }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
        <select
          value={filter.purpose_id || ''}
          onChange={(e) => onFilterChange({ ...filter, purpose_id: e.target.value || undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Purposes</option>
          {purposeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Side</label>
        <select
          value={filter.side || ''}
          onChange={(e) => onFilterChange({ ...filter, side: (e.target.value as Side) || undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sides</option>
          {sideOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
        <select
          value={filter.account_type || ''}
          onChange={(e) => onFilterChange({ ...filter, account_type: (e.target.value as AccountType) || undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          {accountTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={filter.is_active === undefined ? '' : String(filter.is_active)}
          onChange={(e) => onFilterChange({ 
            ...filter, 
            is_active: e.target.value === '' ? undefined : e.target.value === 'true' 
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
    </div>
  )
}