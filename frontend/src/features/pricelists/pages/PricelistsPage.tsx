import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePricelistsStore } from '../store/pricelists.store'
import { PricelistTable } from '../components/PricelistTable'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
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
  const [currentLimit, setCurrentLimit] = useState(10)

  // Confirm modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [itemToRestore, setItemToRestore] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  // Build query from current state
  const query = useMemo((): PricelistListQuery => ({
    page: currentPage,
    limit: currentLimit,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...filters
  }), [currentPage, currentLimit, debouncedSearch, filters])

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
      const timer = setTimeout(() => clearError(), 5000)
      return () => clearTimeout(timer)
    }
  }, [errors.fetch, clearError])

  // Delete handlers
  const handleDeleteClick = useCallback((id: string) => {
    setItemToDelete(id)
    setDeleteModalOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!itemToDelete) return
    try {
      await deletePricelist(itemToDelete)
      toast.success('Pricelist deleted successfully')
    } catch {
      toast.error('Failed to delete pricelist')
    } finally {
      setDeleteModalOpen(false)
      setItemToDelete(null)
    }
  }, [itemToDelete, deletePricelist, toast])

  // Restore handlers
  const handleRestoreClick = useCallback((id: string) => {
    setItemToRestore(id)
    setRestoreModalOpen(true)
  }, [])

  const handleRestoreConfirm = useCallback(async () => {
    if (!itemToRestore) return
    try {
      await restorePricelist(itemToRestore)
      toast.success('Pricelist restored successfully')
    } catch {
      toast.error('Failed to restore pricelist')
    } finally {
      setRestoreModalOpen(false)
      setItemToRestore(null)
    }
  }, [itemToRestore, restorePricelist, toast])

  const handleApprove = useCallback(async (id: string) => {
    try {
      await approvePricelist(id, { status: 'APPROVED' })
      toast.success('Pricelist approved successfully')
    } catch {
      toast.error('Failed to approve pricelist')
    }
  }, [approvePricelist, toast])

  const handleFilterChange = useCallback((key: string, value: unknown) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }))
    setCurrentPage(1) // Reset to first page when filtering
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handleLimitChange = useCallback((limit: number) => {
    setCurrentLimit(limit)
    setCurrentPage(1)
  }, [])

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => v !== undefined && v !== '').length
  }, [filters])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Pricelists</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pagination?.total || 0} total pricelists
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/pricelists/new')} 
            className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-600 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-500 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Pricelist
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by supplier, product, or price..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-green-600 text-white text-xs rounded-full px-2 py-0.5 min-w-5 text-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={filters.status || ''}
                  onChange={e => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Active Status
                </label>
                <select
                  value={filters.is_active === undefined ? '' : filters.is_active.toString()}
                  onChange={e => handleFilterChange('is_active', e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Valid On Date
                </label>
                <input
                  type="date"
                  value={filters.valid_on || ''}
                  onChange={e => handleFilterChange('valid_on', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Include Deleted
                </label>
                <select
                  value={filters.include_deleted === undefined ? '' : filters.include_deleted.toString()}
                  onChange={e => handleFilterChange('include_deleted', e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-red-800 dark:text-red-300">{errors.fetch}</p>
            <button
              onClick={() => clearError()}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
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
          onDelete={handleDeleteClick}
          onRestore={handleRestoreClick}
          onApprove={handleApprove}
          onView={id => navigate(`/pricelists/${id}`)}
          onSort={() => {}} // TODO: Implement sorting
        />

        {/* Pagination */}
        {pagination && pagination.total > 0 && (pricelists || []).length > 0 && (
          <div className="mt-6">
            <Pagination
              pagination={{
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.total,
                totalPages: pagination.totalPages,
                hasNext: pagination.hasNext,
                hasPrev: pagination.hasPrev
              }}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              currentLength={(pricelists || []).length}
              loading={loading.fetch}
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Pricelist"
        message="Are you sure you want to delete this pricelist? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={loading.delete}
      />

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        onConfirm={handleRestoreConfirm}
        title="Restore Pricelist"
        message="Are you sure you want to restore this pricelist?"
        confirmText="Restore"
        variant="success"
        isLoading={loading.update}
      />
    </div>
  )
}

