import { useState, useEffect } from 'react'
import { Search, Filter, X } from 'lucide-react'
import type { FilterParams, AppliedToType } from '../types/accounting-purpose.types'
import { APPLIED_TO_OPTIONS } from '../constants/accounting-purpose.constants'

interface AccountingPurposeFiltersProps {
  onSearch: (query: string) => void
  onFilter: (filters: FilterParams) => void
  loading?: boolean
}

export const AccountingPurposeFilters = ({ onSearch, onFilter, loading }: AccountingPurposeFiltersProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [appliedTo, setAppliedTo] = useState<AppliedToType | ''>('')
  const [isActive, setIsActive] = useState<boolean | ''>('')
  const [deletedFilter, setDeletedFilter] = useState<'active' | 'deleted'>('active')
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchQuery)
  }

  // Reactive filter trigger - no race condition
  useEffect(() => {
    const filters: FilterParams = {
      show_deleted: deletedFilter === 'deleted'
    }
    if (appliedTo) filters.applied_to = appliedTo
    if (isActive !== '') filters.is_active = isActive
    console.log('Filter changed:', { deletedFilter, show_deleted: filters.show_deleted })
    onFilter(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedTo, isActive, deletedFilter])

  const clearFilters = () => {
    setAppliedTo('')
    setIsActive('')
    setDeletedFilter('active')
  }

  const hasActiveFilters = appliedTo || isActive !== '' || deletedFilter !== 'active'

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search purposes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
        </form>
        
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
            hasActiveFilters 
              ? 'border-blue-500 bg-blue-50 text-blue-700' 
              : 'border-gray-300 hover:bg-gray-50'
          }`}
          disabled={loading}
        >
          <Filter size={16} />
          Filters
          {hasActiveFilters && (
            <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {(appliedTo ? 1 : 0) + (isActive !== '' ? 1 : 0) + (deletedFilter !== 'active' ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Applied To
              </label>
              <select
                value={appliedTo}
                onChange={(e) => setAppliedTo(e.target.value as AppliedToType | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">All Types</option>
                {APPLIED_TO_OPTIONS.map(option => (
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
                value={isActive === '' ? '' : isActive.toString()}
                onChange={(e) => setIsActive(e.target.value === '' ? '' : e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deleted Status
              </label>
              <select
                value={deletedFilter}
                onChange={(e) => setDeletedFilter(e.target.value as 'active' | 'deleted')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="active">Active Only</option>
                <option value="deleted">Deleted Only</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={loading || !hasActiveFilters}
              >
                <X size={16} />
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
