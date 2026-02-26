import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitTable } from '../components/MetricUnitTable'
import { useToast } from '@/contexts/ToastContext'
import Pagination from '@/components/ui/Pagination'
import { Ruler, Plus, Search, Filter, X } from 'lucide-react'

function debounce(fn: (value: string) => void, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (value: string) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(value), delay)
  }
}

export default function MetricUnitsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { 
    metricUnits, 
    loading, 
    pagination, 
    filterOptions,
    deleteMetricUnit,
    restoreMetricUnit,
    searchMetricUnits,
    fetchMetricUnits,
    setPage,
    setFilter,
    setLimit
  } = useMetricUnitsStore()
  
  const [search, setSearch] = useState('')
  const [localFilter, setLocalFilter] = useState<{ metric_type?: string; is_active?: string }>({})
  const [showFilter, setShowFilter] = useState(false)

  // Fetch data when page/limit changes
  useEffect(() => {
    fetchMetricUnits()
  }, [pagination.page, pagination.limit, fetchMetricUnits])

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      if (value) {
        searchMetricUnits(value)
      } else {
        setFilter(null)
      }
    }, 300),
    [searchMetricUnits, setFilter]
  )

  useEffect(() => {
    fetchMetricUnits()
    useMetricUnitsStore.getState().fetchFilterOptions()
    return () => {
      useMetricUnitsStore.getState().reset()
    }
  }, [])

  useEffect(() => {
    debouncedSearch(search)
  }, [search, debouncedSearch])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to page 1 when limit changes
  }

  const activeFilterCount = (localFilter.metric_type ? 1 : 0) + (localFilter.is_active ? 1 : 0)

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMetricUnit(id)
      toast.success('Metric unit deleted successfully')
      fetchMetricUnits()
    } catch {
      toast.error('Failed to delete metric unit')
    }
  }, [deleteMetricUnit, toast, fetchMetricUnits])

  const handleRestore = useCallback(async (id: string) => {
    try {
      await restoreMetricUnit(id)
      toast.success('Metric unit restored successfully')
      fetchMetricUnits()
    } catch {
      toast.error('Failed to restore metric unit')
    }
  }, [restoreMetricUnit, toast, fetchMetricUnits])

  const handleFilterChange = (key: string, value: string) => {
    const newLocalFilter = { ...localFilter, [key]: value }
    setLocalFilter(newLocalFilter)
    
    const apiFilter: Record<string, string | boolean> = {}
    if (newLocalFilter.metric_type) apiFilter.metric_type = newLocalFilter.metric_type
    if (newLocalFilter.is_active) apiFilter.is_active = newLocalFilter.is_active === 'true'
    if (search) apiFilter.q = search
    
    setFilter(apiFilter)
  }

  const paginationInfo = {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    totalPages: pagination.totalPages,
    hasNext: pagination.hasNext,
    hasPrev: pagination.hasPrev
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ruler className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Metric Units</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} total</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/metric-units/new')} 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Metric Unit
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by unit name or notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilter 
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400' 
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        
        {/* Filter Panel */}
        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metric Type</label>
              <select
                value={localFilter.metric_type || ''}
                onChange={e => handleFilterChange('metric_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Types</option>
                {filterOptions?.metric_types.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={localFilter.is_active || ''}
                onChange={e => handleFilterChange('is_active', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Status</option>
                {filterOptions?.statuses.map(status => (
                  <option key={String(status.value)} value={String(status.value)}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
              <MetricUnitTable 
                metricUnits={metricUnits} 
                onEdit={id => navigate(`/metric-units/${id}/edit`)} 
                onDelete={handleDelete}
                onRestore={handleRestore}
                loading={loading}
              />
            </div>
            
            {/* Global Pagination Component */}
            {pagination.total > 0 && (
              <Pagination
                pagination={paginationInfo}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                currentLength={metricUnits.length}
                loading={loading}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

