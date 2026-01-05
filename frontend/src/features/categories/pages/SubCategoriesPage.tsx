import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategoriesStore } from '../store/categories.store'
import { SubCategoryTable } from '../components/SubCategoryTable'
import { useToast } from '@/contexts/ToastContext'
import { useBulkSelection } from '@/hooks/_shared/useBulkSelection'
import BulkActionBar from '@/components/BulkActionBar'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FolderTree, Plus, Search, Filter, X } from 'lucide-react'

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

export default function SubCategoriesPage() {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const { subCategories, categories, loading, fetchSubCategories, searchSubCategories, deleteSubCategory, bulkDeleteSubCategories, restoreSubCategory, fetchCategories } = useCategoriesStore()
  
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
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
  } = useBulkSelection(subCategories)

  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      if (value) {
        searchSubCategories(value, 1, 1000)
      } else {
        fetchSubCategories(1, 1000, categoryFilter, deletedFilter)
      }
    }, 300),
    [searchSubCategories, fetchSubCategories, categoryFilter, deletedFilter]
  )

  useEffect(() => {
    fetchCategories(1, 1000)
  }, [fetchCategories])

  useEffect(() => {
    fetchSubCategories(1, 1000, categoryFilter, deletedFilter)
  }, [fetchSubCategories, categoryFilter, deletedFilter])

  useEffect(() => {
    debouncedSearch(search)
  }, [search, debouncedSearch])

  const handleDelete = useCallback((id: string, name: string) => {
    setConfirm({
      open: true,
      title: 'Delete Sub-Category',
      message: `Delete "${name}" permanently? This action cannot be undone.`,
      action: async () => {
        await deleteSubCategory(id)
        success('Sub-category deleted successfully')
        clearSelection()
      }
    })
  }, [deleteSubCategory, success, clearSelection])

  const handleRestore = useCallback((id: string, name: string) => {
    setConfirm({
      open: true,
      title: 'Restore Sub-Category',
      message: `Restore "${name}"?`,
      action: async () => {
        await restoreSubCategory(id)
        success('Sub-category restored successfully')
        clearSelection()
      }
    })
  }, [restoreSubCategory, success, clearSelection])

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return
    
    const validIds = selectedIds.filter(id => subCategories.some(sc => sc.id === id))
    if (validIds.length === 0) {
      toastError('Selected sub-categories no longer available')
      clearSelection()
      return
    }
    
    setConfirm({
      open: true,
      title: 'Delete Multiple Sub-Categories',
      message: `Delete ${validIds.length} sub-category(ies)? This action cannot be undone.`,
      action: async () => {
        await bulkDeleteSubCategories(validIds)
        success(`${validIds.length} sub-category(ies) deleted`)
        clearSelection()
      }
    })
  }, [selectedCount, selectedIds, subCategories, bulkDeleteSubCategories, success, toastError, clearSelection])

  const handleBulkRestore = useCallback(() => {
    if (selectedCount === 0) return
    
    const validIds = selectedIds.filter(id => subCategories.some(sc => sc.id === id))
    if (validIds.length === 0) {
      toastError('Selected sub-categories no longer available')
      clearSelection()
      return
    }
    
    setConfirm({
      open: true,
      title: 'Restore Multiple Sub-Categories',
      message: `Restore ${validIds.length} sub-category(ies)?`,
      action: async () => {
        for (const id of validIds) {
          await restoreSubCategory(id)
        }
        success(`${validIds.length} sub-category(ies) restored`)
        clearSelection()
      }
    })
  }, [selectedCount, selectedIds, subCategories, restoreSubCategory, success, toastError, clearSelection])

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
    if (categoryFilter) count++
    if (deletedFilter !== 'false') count++
    return count
  }, [categoryFilter, deletedFilter])

  const bulkActions = useMemo(() => {
    if (deletedFilter === 'true') {
      return [
        { label: 'Restore', onClick: handleBulkRestore, className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700' }
      ]
    }
    return [
      { label: 'Delete', onClick: handleBulkDelete, className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700' }
    ]
  }, [deletedFilter, handleBulkDelete, handleBulkRestore])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderTree className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Sub-Categories</h1>
              <p className="text-sm text-gray-500">{subCategories.length} total</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sub-categories/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Sub-Category
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
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sub-categories..."
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
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.category_name}</option>
              ))}
            </select>
            <select
              value={deletedFilter}
              onChange={e => setDeletedFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-3">
          <BulkActionBar selectedCount={selectedCount} actions={bulkActions} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <SubCategoryTable
              subCategories={subCategories}
              onView={id => navigate(`/sub-categories/${id}`)}
              onEdit={id => navigate(`/sub-categories/${id}/edit`)}
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
