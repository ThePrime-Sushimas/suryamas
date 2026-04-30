import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategoriesStore } from '../store/categories.store'
import { CategoryTable } from '../components/CategoryTable'
import { useToast } from '@/contexts/ToastContext'
import { useBulkSelection } from '@/hooks/_shared/useBulkSelection'
import BulkActionBar from '@/components/BulkActionBar'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { FolderOpen, Plus, Search, Filter, X, AlertCircle } from 'lucide-react'

type ConfirmState = {
  open: boolean
  title: string
  message: string
  action: () => Promise<void>
} | null

export default function CategoriesPage() {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const { 
    categories, 
    loading, 
    fetchCategories, 
    searchCategories, 
    deleteCategory, 
    bulkDeleteCategories, 
    updateCategoryStatus, 
    restoreCategory,
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    setPage,
    setLimit
  } = useCategoriesStore()
  
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)
  const [statusFilter, setStatusFilter] = useState('')
  const [deletedFilter, setDeletedFilter] = useState('false')
  const [showFilter, setShowFilter] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const {
    selectedIds,
    selectedCount,
    selectAll,
    selectOne,
    clearSelection,
    isSelected,
    isAllSelected
  } = useBulkSelection(categories)

  const fetchData = useCallback(() => {
    if (debouncedSearch) {
      searchCategories(debouncedSearch, page, limit)
    } else {
      fetchCategories(page, limit, statusFilter, deletedFilter)
    }
  }, [page, limit, debouncedSearch, statusFilter, deletedFilter, fetchCategories, searchCategories])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to page 1 when limit changes
  }

  const handleDelete = useCallback((id: string, name: string) => {
    setConfirm({
      open: true,
      title: 'Hapus Kategori',
      message: `Hapus "${name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`,
      action: async () => {
        await deleteCategory(id)
        success('Kategori berhasil dihapus')
        clearSelection()
        // Refresh data after delete
        fetchData()
      }
    })
  }, [deleteCategory, success, clearSelection, fetchData])

  const handleRestore = useCallback((id: string, name: string) => {
    setConfirm({
      open: true,
      title: 'Restore Kategori',
      message: `Restore "${name}"?`,
      action: async () => {
        await restoreCategory(id)
        success('Kategori berhasil direstore')
        clearSelection()
        // Refresh data after restore
        fetchData()
      }
    })
  }, [restoreCategory, success, clearSelection, fetchData])

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return
    
    const validIds = selectedIds.filter(id => categories.some(c => c.id === id))
    if (validIds.length === 0) {
      toastError('Selected categories no longer available')
      clearSelection()
      return
    }
    
    setConfirm({
      open: true,
      title: 'Hapus Beberapa Kategori',
      message: `Hapus ${validIds.length} kategori? Tindakan ini tidak dapat dibatalkan.`,
      action: async () => {
        await bulkDeleteCategories(validIds)
        success(`${validIds.length} kategori berhasil dihapus`)
        clearSelection()
        // Refresh data after bulk delete
        fetchData()
      }
    })
  }, [selectedCount, selectedIds, categories, bulkDeleteCategories, success, toastError, clearSelection, fetchData])

  const handleBulkRestore = useCallback(() => {
    if (selectedCount === 0) return
    
    const validIds = selectedIds.filter(id => categories.some(c => c.id === id))
    if (validIds.length === 0) {
      toastError('Selected categories no longer available')
      clearSelection()
      return
    }
    
    setConfirm({
      open: true,
      title: 'Restore Beberapa Kategori',
      message: `Restore ${validIds.length} kategori?`,
      action: async () => {
        for (const id of validIds) {
          await restoreCategory(id)
        }
        success(`${validIds.length} kategori berhasil direstore`)
        clearSelection()
        // Refresh data after bulk restore
        fetchData()
      }
    })
  }, [selectedCount, selectedIds, categories, restoreCategory, success, toastError, clearSelection, fetchData])

  const handleBulkStatus = useCallback((isActive: boolean) => {
    if (selectedCount === 0) return
    
    const validIds = selectedIds.filter(id => categories.some(c => c.id === id))
    if (validIds.length === 0) {
      toastError('Selected categories no longer available')
      clearSelection()
      return
    }
    
    setConfirm({
      open: true,
      title: isActive ? 'Set Aktif' : 'Set Nonaktif',
      message: `Update ${validIds.length} kategori menjadi ${isActive ? 'Aktif' : 'Nonaktif'}?`,
      action: async () => {
        for (const id of validIds) {
          await updateCategoryStatus(id, isActive)
        }
        success(`${validIds.length} kategori berhasil diupdate`)
        clearSelection()
      }
    })
  }, [selectedCount, selectedIds, categories, updateCategoryStatus, success, toastError, clearSelection])

  const handleConfirm = useCallback(async () => {
    if (!confirm || isConfirming) return
    setIsConfirming(true)
    try {
      await confirm.action()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Terjadi kesalahan'
      toastError(message)
    } finally {
      setIsConfirming(false)
      setConfirm(null)
    }
  }, [confirm, isConfirming, toastError])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilter) count++
    if (deletedFilter !== 'false') count++
    return count
  }, [statusFilter, deletedFilter])

  const bulkActions = useMemo(() => {
    if (deletedFilter === 'true') {
      return [
        { label: 'Restore', onClick: handleBulkRestore, className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700' }
      ]
    }
    return [
      { label: 'Set Active', onClick: () => handleBulkStatus(true), className: 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700' },
      { label: 'Set Inactive', onClick: () => handleBulkStatus(false), className: 'px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700' },
      { label: 'Delete', onClick: handleBulkDelete, className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700' }
    ]
  }, [deletedFilter, handleBulkStatus, handleBulkDelete, handleBulkRestore])

  const paginationInfo = useMemo(() => ({
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev
  }), [page, limit, total, totalPages, hasNext, hasPrev])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Categories</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{total} total</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/categories/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Category
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
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search categories..."
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
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <select
              value={deletedFilter}
              onChange={e => setDeletedFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="false">Active Items</option>
              <option value="true">Deleted Items</option>
              <option value="">All Items</option>
            </select>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className="px-6 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center gap-3">
          <BulkActionBar selectedCount={selectedCount} actions={bulkActions} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="animate-pulse">
              <div className="h-10 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/6" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <CategoryTable
                categories={categories}
                onView={id => navigate(`/categories/${id}`)}
                onEdit={id => navigate(`/categories/${id}/edit`)}
                onDelete={handleDelete}
                onRestore={handleRestore}
                isSelected={isSelected}
                onSelect={selectOne}
                isAllSelected={isAllSelected}
                onSelectAll={selectAll}
                showDeleted={deletedFilter === 'true'}
              />
            </div>
            
            {/* Global Pagination Component */}
            {total > 0 && (
              <Pagination
                pagination={paginationInfo}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                currentLength={categories.length}
                loading={loading}
              />
            )}
          </>
        )}
      </div>

      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          isOpen={confirm.open}
          title={confirm.title}
          message={confirm.message}
          onConfirm={handleConfirm}
          onClose={() => !isConfirming && setConfirm(null)}
          confirmText={isConfirming ? 'Memproses...' : 'Konfirmasi'}
          variant="danger"
          isLoading={isConfirming}
        />
      )}
    </div>
  )
}
