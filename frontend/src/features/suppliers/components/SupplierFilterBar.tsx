import { SUPPLIER_TYPE_OPTIONS, STATUS_OPTIONS } from '../constants/supplier.constants'
import type { SupplierType } from '../types/supplier.types'

interface SupplierFilterBarProps {
  search: string
  supplierType: SupplierType | ''
  isActive: string
  includeDeleted: boolean
  onSearchChange: (value: string) => void
  onSupplierTypeChange: (value: SupplierType | '') => void
  onIsActiveChange: (value: string) => void
  onIncludeDeletedChange: (value: boolean) => void
  onReset: () => void
}

export function SupplierFilterBar({
  search,
  supplierType,
  isActive,
  includeDeleted,
  onSearchChange,
  onSupplierTypeChange,
  onIsActiveChange,
  onIncludeDeletedChange,
  onReset,
}: SupplierFilterBarProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Code or name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supplier Type
          </label>
          <select
            value={supplierType}
            onChange={(e) => onSupplierTypeChange(e.target.value as SupplierType | '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {SUPPLIER_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={isActive}
            onChange={(e) => onIsActiveChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => onIncludeDeletedChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Show Deleted</span>
          </label>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Reset Filters
        </button>
      </div>
    </div>
  )
}