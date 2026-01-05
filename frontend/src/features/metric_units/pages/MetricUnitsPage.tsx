import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitTable } from '../components/MetricUnitTable'
import { useToast } from '@/contexts/ToastContext'
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
    setPage,
    setFilter
  } = useMetricUnitsStore()
  
  const [search, setSearch] = useState('')
  const [localFilter, setLocalFilter] = useState<{ metric_type?: string; is_active?: string }>({})
  const [showFilter, setShowFilter] = useState(false)

  const debouncedSearchRef = useRef<((value: string) => void) | undefined>(undefined)

  useEffect(() => {
    debouncedSearchRef.current = debounce((value: string) => {
      if (value) {
        searchMetricUnits(value)
      } else {
        const currentFilter = useMetricUnitsStore.getState().filter
        const newFilter = currentFilter ? { ...currentFilter, q: undefined } : null
        setFilter(newFilter)
      }
    }, 300)
  }, [searchMetricUnits, setFilter])

  useEffect(() => {
    const store = useMetricUnitsStore.getState()
    store.fetchMetricUnits()
    store.fetchFilterOptions()
    
    return () => {
      store.reset()
    }
  }, [])

  const activeFilterCount = (localFilter.metric_type ? 1 : 0) + (localFilter.is_active ? 1 : 0)

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMetricUnit(id)
      toast.success('Metric unit deleted successfully')
    } catch {
      toast.error('Failed to delete metric unit')
    }
  }, [deleteMetricUnit, toast])

  const handleRestore = useCallback(async (id: string) => {
    try {
      await restoreMetricUnit(id)
      toast.success('Metric unit restored successfully')
    } catch {
      toast.error('Failed to restore metric unit')
    }
  }, [restoreMetricUnit, toast])

  const handleFilterChange = (key: string, value: string) => {
    const newLocalFilter = { ...localFilter, [key]: value }
    setLocalFilter(newLocalFilter)
    
    const apiFilter: Record<string, string | boolean> = {}
    if (newLocalFilter.metric_type) apiFilter.metric_type = newLocalFilter.metric_type
    if (newLocalFilter.is_active) apiFilter.is_active = newLocalFilter.is_active === 'true'
    if (search) apiFilter.q = search
    
    setFilter(apiFilter)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ruler className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Metric Units</h1>
              <p className="text-sm text-gray-500">{pagination.total} total</p>
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
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by unit name or notes..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                debouncedSearchRef.current?.(e.target.value)
              }}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilter ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
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
          <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metric Type</label>
              <select
                value={localFilter.metric_type || ''}
                onChange={e => handleFilterChange('metric_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
    </div>
  )
}
