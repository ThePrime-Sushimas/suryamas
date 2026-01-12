import type { ChartOfAccountFilter, AccountType } from '../types/chart-of-account.types'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '../constants/chart-of-account.constants'

interface ChartOfAccountFiltersProps {
  filter: ChartOfAccountFilter
  onFilterChange: <K extends keyof ChartOfAccountFilter>(key: K, value?: ChartOfAccountFilter[K]) => void
  showFilter: boolean
}

export const ChartOfAccountFilters = ({ filter, onFilterChange, showFilter }: ChartOfAccountFiltersProps) => {
  if (!showFilter) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-3 gap-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
        <select
          value={filter.account_type || ''}
          onChange={e => onFilterChange('account_type', (e.target.value || undefined) as AccountType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        >
          <option value="">All Types</option>
          {ACCOUNT_TYPES.map(type => (
            <option key={type} value={type}>{ACCOUNT_TYPE_LABELS[type]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Account Subtype</label>
        <input
          type="text"
          value={filter.account_subtype || ''}
          onChange={e => onFilterChange('account_subtype', e.target.value || undefined)}
          placeholder="Enter subtype..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={filter.is_active === undefined ? '' : filter.is_active ? 'active' : 'inactive'}
          onChange={e => {
            const value = e.target.value
            onFilterChange('is_active', value === '' ? undefined : value === 'active')
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Header Account</label>
        <select
          value={filter.is_header === undefined ? '' : filter.is_header ? 'yes' : 'no'}
          onChange={e => {
            const value = e.target.value
            onFilterChange('is_header', value === '' ? undefined : value === 'yes')
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        >
          <option value="">All</option>
          <option value="yes">Header Only</option>
          <option value="no">Non-Header Only</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Postable</label>
        <select
          value={filter.is_postable === undefined ? '' : filter.is_postable ? 'yes' : 'no'}
          onChange={e => {
            const value = e.target.value
            onFilterChange('is_postable', value === '' ? undefined : value === 'yes')
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
        >
          <option value="">All</option>
          <option value="yes">Postable Only</option>
          <option value="no">Non-Postable Only</option>
        </select>
      </div>
    </div>
  )
}