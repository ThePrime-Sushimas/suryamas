import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategoriesStore } from '../store/categories.store'
import { CategoryTable } from '../components/CategoryTable'
import { useToast } from '@/contexts/ToastContext'
import { useBulkSelection } from '@/hooks/_shared/useBulkSelection'
import BulkActionBar from '@/components/BulkActionBar'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'
import { FolderOpen, Plus, Search, Filter, X } from 'lucide-react'

function debounce(fn: (value: string) => void, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (value: string) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(value), delay)
  }
}

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
    hasPrev
  } = useCategoriesStore()
  
  const [search, setSearch] = useState('')
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

  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      if (value) {
        searchCategories(value, 1, limit)
      } else {
        fetchCategories(1, limit, statusFilter, deletedFilter)
      }
    }, 300),
    [searchCategories, fetchCategories, statusFilter, deletedFilter, limit]
  )

  useEffect(() => {
    fetchCategories(1, limit, statusFilter, deletedFilter)
  }, [fetchCategories, statusFilter, deletedFilter, limit])

  useEffect(() => {
    debouncedSearch(search)
  }, [search, debouncedSearch])

  const handlePageChange = useCallback((newPage: number) => {
    if (search) {
      searchCategories(search, newPage, limit)
    } else {
      fetchCategories(newPage, limit, statusFilter, deletedFilter)
    }
  }, [search, searchCategories, fetchCategories, limit, statusFilter, deletedFilter])

  const handleLimitChange = useCallback((newLimit: number) => {
    if (search) {
      searchCategories(search, 1, newLimit)
    } else {
      fetchCategories(1, newLimit, statusFilter, deletedFilter)
    }
  }, [search, searchCategories, fetchCategories, statusFilter, deletedFilter])

  const handleDelete = useCallback((id: string, name: string) => {
    setConfirm({
      open: true,
      title: 'Delete Category',
      message: `Delete "${name}" permanently? This action cannot be undone.`,
      action: async () => {
        await deleteCategory(id)
        success('Category deleted successfully')
        clearSelection()
      }
    })
  }, [deleteCategory, success, clearSelection])

  const handleRestore = useCallback((id: string, name: string) => {
    setConfirm({
      open: true,
      title: 'Restore Category',
      message: `Restore "${name}"?`,
      action: async () => {
        await restoreCategory(id)
        success('Category restored successfully')
        clearSelection()
      }
    })
  }, [restoreCategory, success, clearSelection])

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
      title: 'Delete Multiple Categories',
      message: `Delete ${validIds.length} category(ies)? This action cannot be undone.`,
      action: async () => {
        await bulkDeleteCategories(validIds)
        success(`${validIds.length} category(ies) deleted`)
        clearSelection()
      }
    })
  }, [selectedCount, selectedIds, categories, bulkDeleteCategories, success, toastError, clearSelection])

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
      title: 'Restore Multiple Categories',
      message: `Restore ${validIds.length} category(ies)?`,
      action: async () => {
        for (const id of validIds) {
          await restoreCategory(id)
        }
        success(`${validIds.length} category(ies) restored`)
        clearSelection()
      }
    })
  }, [selectedCount, selectedIds, categories, restoreCategory, success, toastError, clearSelection])

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
      title: isActive ? 'Set Active' : 'Set Inactive',
      message: `Update ${validIds.length} category(ies) to ${isActive ? 'Active' : 'Inactive'}?`,
      action: async () => {
        for (const id of validIds) {
          await updateCategoryStatus(id, isActive)
        }
        success(`${validIds.length} category(ies) updated`)
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
      const message = e instanceof Error ? e.message : 'Action failed'
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
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/50">
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
        )}
      </div>

      {/* Pagination */}
      <div className="px-6 pb-6">
        <Pagination
          pagination={paginationInfo}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          currentLength={categories.length}
          loading={loading}
        />
      </div>

      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          isOpen={confirm.open}
          title={confirm.title}
          message={confirm.message}
          onConfirm={handleConfirm}
          onClose={() => !isConfirming && setConfirm(null)}
          confirmText={isConfirming ? 'Processing...' : 'Confirm'}
          variant="danger"
          isLoading={isConfirming}
        />
      )}
    </div>
  )
}
