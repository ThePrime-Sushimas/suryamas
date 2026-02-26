import { Filter } from 'lucide-react'
import type { CalculationType } from '../types'

interface PaymentTermFiltersProps {
  isOpen: boolean
  onToggle: () => void
  calculationType?: string
  isActive?: string
  includeDeleted?: string
  onCalculationTypeChange: (value: string) => void
  onIsActiveChange: (value: string) => void
  onIncludeDeletedChange: (value: string) => void
  activeCount: number
}

const CALCULATION_TYPES: { value: CalculationType; label: string }[] = [
  { value: 'from_invoice', label: 'From Invoice Date' },
  { value: 'from_delivery', label: 'From Delivery Date' },
  { value: 'fixed_date', label: 'Fixed Dates' },
  { value: 'fixed_date_immediate', label: 'Fixed Dates (Immediate)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
]

export const PaymentTermFilters = ({
  isOpen,
  onToggle,
  calculationType,
  isActive,
  includeDeleted,
  onCalculationTypeChange,
  onIsActiveChange,
  onIncludeDeletedChange,
  activeCount
}: PaymentTermFiltersProps) => {
  return (
    <>
      <button
        onClick={onToggle}
        className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
          isOpen 
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' 
            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
        }`}
      >
        <Filter className="w-4 h-4" />
        {activeCount > 0 && (
          <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Calculation Type
            </label>
            <select
              value={calculationType || ''}
              onChange={e => onCalculationTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Types</option>
              {CALCULATION_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={isActive || ''}
              onChange={e => onIsActiveChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Show Deleted
            </label>
            <select
              value={includeDeleted || ''}
              onChange={e => onIncludeDeletedChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Active Only</option>
              <option value="true">Include Deleted</option>
            </select>
          </div>
        </div>
      )}
    </>
  )
}
