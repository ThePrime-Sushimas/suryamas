import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { metricUnitService } from '@/services/metricUnitService'
import type { MetricUnit, MetricType } from '@/types/metricUnit'
import MetricUnitTable from '@/components/metric-units/MetricUnitTable'
import { useBulkSelection } from '@/hooks/useBulkSelection'

export default function MetricUnitsPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<MetricUnit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [metricTypeFilter, setMetricTypeFilter] = useState<MetricType | ''>('')
  const [statusFilter, setStatusFilter] = useState<boolean | ''>('')
  const [sortField, setSortField] = useState('metric_type')
  const [filterOptions, setFilterOptions] = useState<{ metric_types: string[]; statuses: boolean[] }>({ metric_types: [], statuses: [] })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      newSet.has(id) ? newSet.delete(id) : newSet.add(id)
      return newSet
    })
  }
  const toggleSelectAll = (ids: string[], selected: boolean) => {
    setSelectedIds(selected ? new Set(ids) : new Set())
  }
  const clearSelection = () => setSelectedIds(new Set())

  useEffect(() => {
    loadFilterOptions()
  }, [])

  useEffect(() => {
    loadData()
  }, [page, limit, searchTerm, metricTypeFilter, statusFilter, sortField])

  const loadFilterOptions = async () => {
    try {
      const options = await metricUnitService.filterOptions()
      setFilterOptions(options)
    } catch (error) {
      console.error('Failed to load filter options:', error)
      setFilterOptions({ metric_types: ['Unit', 'Volume', 'Weight'], statuses: [true, false] })
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const result = await metricUnitService.list(page, limit, { field: sortField, order: 'asc' }, {
        metric_type: metricTypeFilter || undefined,
        is_active: statusFilter === '' ? undefined : statusFilter,
        q: searchTerm || undefined
      })
      setData(result.data)
      setTotal(result.pagination.total)
    } catch (error) {
      console.error('Failed to load metric units:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkStatusChange = async (is_active: boolean) => {
    if (selectedIds.size === 0) return
    try {
      await metricUnitService.bulkUpdateStatus(Array.from(selectedIds), is_active)
      clearSelection()
      loadData()
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return
    try {
      await metricUnitService.delete(id)
      loadData()
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Metric Units</h1>
        <button
          onClick={() => navigate('/metric-units/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          New Unit
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(1) }}
                placeholder="Search..."
                className="w-full pl-10 pr-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={metricTypeFilter}
              onChange={e => { setMetricTypeFilter(e.target.value as MetricType | ''); setPage(1) }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Types</option>
              {filterOptions.metric_types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value === '' ? '' : e.target.value === 'true'); setPage(1) }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Sort</label>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="metric_type">Type</option>
              <option value="unit_name">Unit Name</option>
              <option value="created_at">Created</option>
            </select>
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg flex justify-between items-center">
          <span className="text-sm">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button onClick={() => handleBulkStatusChange(true)} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Set Active</button>
            <button onClick={() => handleBulkStatusChange(false)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">Set Inactive</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <MetricUnitTable
          data={data}
          isLoading={isLoading}
          selectedIds={Array.from(selectedIds)}
          onSelect={id => toggleSelect(id)}
          onSelectAll={selected => toggleSelectAll(data.map(d => d.id), selected)}
          onEdit={id => navigate(`/metric-units/${id}/edit`)}
          onDelete={handleDelete}
        />
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}</div>
        <div className="flex gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  )
}
