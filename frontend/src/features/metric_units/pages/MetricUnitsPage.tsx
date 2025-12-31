import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitTable } from '../components/MetricUnitTable'
import { useToast } from '@/contexts/ToastContext'

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
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
    fetchMetricUnits, 
    deleteMetricUnit,
    restoreMetricUnit,
    searchMetricUnits,
    setPage,
    setFilter,
    fetchFilterOptions,
    reset
  } = useMetricUnitsStore()
  
  const [search, setSearch] = useState('')
  const [localFilter, setLocalFilter] = useState<{ metric_type?: string; is_active?: string }>({ is_active: 'true' })

  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      if (value) {
        searchMetricUnits(value)
      } else {
        // Remove search query from current filter
        const currentFilter = useMetricUnitsStore.getState().filter
        const newFilter = currentFilter ? { ...currentFilter, q: undefined } : null
        setFilter(newFilter)
      }
    }, 300),
    [searchMetricUnits, setFilter]
  )

  useEffect(() => {
    // Set initial filter to show only active units
    const initialFilter = { is_active: true }
    setFilter(initialFilter)
    fetchMetricUnits()
    fetchFilterOptions()
    return () => reset()
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMetricUnit(id)
      toast.success('Metric unit deleted successfully')
    } catch (error) {
      toast.error('Failed to delete metric unit')
    }
  }, [deleteMetricUnit, toast])

  const handleRestore = useCallback(async (id: string) => {
    try {
      await restoreMetricUnit(id)
      toast.success('Metric unit restored successfully')
    } catch (error) {
      toast.error('Failed to restore metric unit')
    }
  }, [restoreMetricUnit, toast])

  const handleFilterChange = (key: string, value: string) => {
    const newLocalFilter = { ...localFilter, [key]: value }
    setLocalFilter(newLocalFilter)
    
    const apiFilter: any = {}
    if (newLocalFilter.metric_type) apiFilter.metric_type = newLocalFilter.metric_type
    if (newLocalFilter.is_active) apiFilter.is_active = newLocalFilter.is_active === 'true'
    if (search) apiFilter.q = search
    
    setFilter(apiFilter)
  }

  const handleClearFilters = () => {
    setSearch('')
    setLocalFilter({})
    setFilter(null)
  }

  const hasActiveFilters = search || localFilter.metric_type || localFilter.is_active

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Metric Units</h1>
          <p className="text-gray-600 mt-1">Manage unit types for measurements</p>
        </div>
        <button 
          onClick={() => navigate('/metric-units/new')} 
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          + Add Metric Unit
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by unit name or notes..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                debouncedSearch(e.target.value)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metric Type</label>
            <select
              value={localFilter.metric_type || ''}
              onChange={e => handleFilterChange('metric_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              {filterOptions?.metric_types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={localFilter.is_active || ''}
              onChange={e => handleFilterChange('is_active', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              {filterOptions?.statuses.map(status => (
                <option key={String(status.value)} value={String(status.value)}>{status.label}</option>
              ))}
            </select>
          </div>
        </div>
        
        {hasActiveFilters && (
          <div className="flex justify-end">
            <button
              onClick={handleClearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      <MetricUnitTable 
        metricUnits={metricUnits} 
        onEdit={id => navigate(`/metric-units/${id}/edit`)} 
        onDelete={handleDelete}
        onRestore={handleRestore}
        loading={loading}
      />

      {!loading && metricUnits.length > 0 && (
        <div className="mt-6 flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{metricUnits.length}</span> of{' '}
            <span className="font-medium">{pagination.total}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(pagination.page - 1)}
              disabled={!pagination.hasPrev || loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page <span className="font-medium">{pagination.page}</span> of{' '}
              <span className="font-medium">{pagination.totalPages}</span>
            </span>
            <button
              onClick={() => setPage(pagination.page + 1)}
              disabled={!pagination.hasNext || loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
