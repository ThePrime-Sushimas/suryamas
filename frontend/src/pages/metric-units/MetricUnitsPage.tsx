import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { metricUnitService } from '@/services/metricUnitService'
import MetricUnitTable from '@/components/metric-units/MetricUnitTable'
import type { MetricUnit } from '@/types/metricUnit'
import { Search, Gauge, Plus, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react'

export default function MetricUnitsPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<MetricUnit[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await metricUnitService.list(page, limit, { field: 'metric_type', order: 'asc' }, {
        metric_type: filter.metric_type || undefined,
        is_active: filter.is_active !== undefined ? filter.is_active : undefined,
        q: search || undefined
      })
      setData(result.data)
      setTotal(result.pagination.total)
    } catch (err) {
      setError('Failed to load metric units. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, search, JSON.stringify(filter)])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this metric unit?')) {
      try {
        await metricUnitService.delete(id)
        loadData()
      } catch (err) {
        setError('Failed to delete metric unit. Please try again.')
      }
    }
  }

  const setFilterKey = (key: string, value?: any) => {
    setFilter(prev => {
      const next = { ...prev }
      if (value === undefined) delete next[key]
      else next[key] = value
      return next
    })
    setPage(1)
  }

  const handleClearFilters = () => {
    setSearch('')
    setFilter({})
    setPage(1)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      newSet.has(id) ? newSet.delete(id) : newSet.add(id)
      return newSet
    })
  }

  const toggleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? new Set(data.map(d => d.id)) : new Set())
  }

  const handleBulkStatusChange = async (is_active: boolean) => {
    if (selectedIds.size === 0) return
    try {
      await metricUnitService.bulkUpdateStatus(Array.from(selectedIds), is_active)
      setSelectedIds(new Set())
      loadData()
    } catch (err) {
      setError('Failed to update status. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Gauge className="h-8 w-8 text-blue-600" />
                Metric Units Management
              </h1>
              <p className="text-gray-600 mt-2">Manage measurement units and types</p>
            </div>
            <button
              onClick={() => navigate('/metric-units/new')}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl font-medium group"
            >
              <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-200" />
              New Unit
            </button>
          </div>


        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by unit name..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={filter.metric_type || ''}
                onChange={e => setFilterKey('metric_type', e.target.value || undefined)}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
              >
                <option value="">All Types</option>
                <option value="Unit">Unit</option>
                <option value="Volume">Volume</option>
                <option value="Weight">Weight</option>
              </select>



              {(search || Object.keys(filter).length > 0) && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Badges */}
          <div className="flex flex-wrap gap-2">
            {search && (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                Search: {search}
                <button onClick={() => setSearch('')} className="ml-1 hover:text-blue-900">×</button>
              </span>
            )}
            {filter.metric_type && (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
                Type: {filter.metric_type}
                <button onClick={() => setFilterKey('metric_type')} className="ml-1 hover:text-green-900">×</button>
              </span>
            )}

          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">×</button>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
            <span className="text-sm font-medium text-blue-900">{selectedIds.size} selected</span>
            <div className="flex gap-2">
              <button onClick={() => handleBulkStatusChange(true)} className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">Set Active</button>
              <button onClick={() => handleBulkStatusChange(false)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">Set Inactive</button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600 text-lg">Loading metric units...</p>
          </div>
        ) : (
          <>
            {/* Table Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Metric Units List</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} units
                </p>
              </div>

              <div className="overflow-x-auto">
                <MetricUnitTable
                  data={data}
                  isLoading={loading}
                  selectedIds={Array.from(selectedIds)}
                  onSelect={toggleSelect}
                  onSelectAll={toggleSelectAll}
                  onEdit={id => navigate(`/metric-units/${id}/edit`)}
                  onDelete={handleDelete}
                />
              </div>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-gray-600">
                Showing <span className="font-semibold text-gray-900">{(page - 1) * limit + 1}-{Math.min(page * limit, total)}</span> of{' '}
                <span className="font-semibold text-gray-900">{total}</span> units
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={!hasPrev}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (page <= 3) {
                      pageNum = i + 1
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = page - 2 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-10 h-10 rounded-lg font-medium transition-all duration-200 ${
                          page === pageNum ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                  {totalPages > 5 && (
                    <>
                      <span className="px-2 text-gray-400">...</span>
                      <button
                        onClick={() => setPage(totalPages)}
                        className={`w-10 h-10 rounded-lg font-medium transition-all duration-200 ${
                          page === totalPages ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!hasNext}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
                >
                  Next
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
