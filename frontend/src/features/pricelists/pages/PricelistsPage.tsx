import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePricelistsStore } from '../store/pricelists.store'
import { PricelistTable } from '../components/PricelistTable'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { DollarSign, Plus, Search, X, Filter } from 'lucide-react'
import type { PricelistListQuery } from '../types/pricelist.types'

export default function PricelistsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { 
    pricelists, 
    pagination,
    loading,
    errors,
    fetchPricelists,
    deletePricelist,
    restorePricelist,
    approvePricelist,
    clearError,
    reset
  } = usePricelistsStore()
  
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Omit<PricelistListQuery, 'page' | 'limit' | 'search'>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const debouncedSearch = useDebounce(search, 300)

  // Build query from current state
  const query = useMemo((): PricelistListQuery => ({
    page: currentPage,
    limit: 10,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...filters
  }), [currentPage, debouncedSearch, filters])

  // Fetch data when query changes
  useEffect(() => {
    const controller = new AbortController()
    fetchPricelists(query, controller.signal)
    
    return () => controller.abort()
  }, [query, fetchPricelists])

  // Cleanup on unmount
  useEffect(() => {
    return () => reset()
  }, [reset])

  // Clear errors when they exist
  useEffect(() => {
    if (errors.fetch) {
      const timer = setTimeout(() => clearError('fetch'), 5000)
      return () => clearTimeout(timer)
    }
  }, [errors.fetch, clearError])

  const handleDelete = useCallback(async (id: string) => {
    const pricelist = pricelists.find(p => p.id === id)
    const name = pricelist?.product_name || 'this pricelist'
    
    if (!confirm(`Are you sure you want to delete pricelist for "${name}"?`)) return
    
    try {
      await deletePricelist(id)
      toast.success('Pricelist deleted successfully')
    } catch {
      toast.error('Failed to delete pricelist')
    }
  }, [deletePricelist, toast, pricelists])

  const handleRestore = useCallback(async (id: string) => {
    const pricelist = pricelists.find(p => p.id === id)
    const name = pricelist?.product_name || 'this pricelist'
    
    if (!confirm(`Are you sure you want to restore pricelist for "${name}"?`)) return
    
    try {
      await restorePricelist(id)
      toast.success('Pricelist restored successfully')
    } catch {
      toast.error('Failed to restore pricelist')
    }
  }, [restorePricelist, toast, pricelists])

  const handleApprove = useCallback(async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await approvePricelist(id, { status })
      toast.success(`Pricelist ${status.toLowerCase()} successfully`)
    } catch {
      toast.error(`Failed to ${status.toLowerCase()} pricelist`)
    }
  }, [approvePricelist, toast])

  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }))
    setCurrentPage(1) // Reset to first page when filtering
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== undefined && v !== '').length
  }, [filters])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pricelists</h1>
              <p className="text-sm text-gray-500">
                {pagination?.total || 0} total pricelists
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/pricelists/new')} 
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Pricelist
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by supplier, product, or price..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
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
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-green-600 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status || ''}
                  onChange={e => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Active Status
                </label>
                <select
                  value={filters.is_active === undefined ? '' : filters.is_active.toString()}
                  onChange={e => handleFilterChange('is_active', e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valid On Date
                </label>
                <input
                  type="date"
                  value={filters.valid_on || ''}
                  onChange={e => handleFilterChange('valid_on', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Include Deleted
                </label>
                <select
                  value={filters.include_deleted === undefined ? '' : filters.include_deleted.toString()}
                  onChange={e => handleFilterChange('include_deleted', e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {errors.fetch && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-red-800">{errors.fetch}</p>
            <button
              onClick={() => clearError('fetch')}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <PricelistTable 
          data={pricelists || []}
          loading={loading.fetch}
          onEdit={id => navigate(`/pricelists/${id}/edit`)}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onApprove={handleApprove}
          onView={id => navigate(`/pricelists/${id}`)}
          onSort={() => {}} // TODO: Implement sorting
        />

        {/* Pagination */}
        {pagination && pagination.total > 0 && (pricelists || []).length > 0 && (
          <div className="mt-6 flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{(pricelists || []).length}</span> of{' '}
              <span className="font-medium">{pagination.total}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrev || loading.fetch}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page <span className="font-medium">{pagination.page}</span> of{' '}
                <span className="font-medium">{pagination.totalPages}</span>
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNext || loading.fetch}
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