import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategoriesStore } from '../store/categories.store'
import { SubCategoryTable } from '../components/SubCategoryTable'
import { useToast } from '@/contexts/ToastContext'
import { useBulkSelection } from '@/hooks/_shared/useBulkSelection'
import BulkActionBar from '@/components/BulkActionBar'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { FolderTree, Plus, Search, Filter, X, AlertCircle } from 'lucide-react'

type ConfirmState = {
  open: boolean
  title: string
  message: string
  action: () => Promise<void>
} | null

export default function SubCategoriesPage() {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const {
    subCategories,
    categories,
    loading,
    error,
    fetchSubPage,
    searchSubPage,
    deleteSubCategory,
    bulkDeleteSubCategories,
    restoreSubCategory,
    fetchAllCategories,
    subPage,
    subLimit,
    subTotal,
    subTotalPages,
    subHasNext,
    subHasPrev,
  } = useCategoriesStore()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)
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
    isAllSelected,
  } = useBulkSelection(subCategories)

  const doFetch = useCallback((p: number, l?: number) => {
    if (debouncedSearch) {
      searchSubPage(debouncedSearch, p, l)
    } else {
      fetchSubPage(p, l, categoryFilter, deletedFilter)
    }
  }, [debouncedSearch, categoryFilter, deletedFilter, fetchSubPage, searchSubPage])

  useEffect(() => {
    doFetch(1)
  }, [doFetch])

  useEffect(() => {
    fetchAllCategories()
  }, [fetchAllCategories])

  const handlePageChange = (newPage: number) => doFetch(newPage)
  const handleLimitChange = (newLimit: number) => doFetch(1, newLimit)

  const handleDelete = useCallback((id: string, name: string) => {
    setConfirm({
      open: true,
      title: 'Hapus Sub-Kategori',
      message: `Hapus "${name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`,
      action: async () => {
        await deleteSubCategory(id)
        success('Sub-kategori berhasil dihapus')
        clearSelection()
        doFetch(1)
      },
    })
  }, [deleteSubCategory, success, clearSelection, doFetch])

  const handleRestore = useCallback((id: string, name: string) => {
    setConfirm({
      open: true,
      title: 'Restore Sub-Kategori',
      message: `Restore "${name}"?`,
      action: async () => {
        await restoreSubCategory(id)
        success('Sub-kategori berhasil direstore')
        clearSelection()
        doFetch(1)
      },
    })
  }, [restoreSubCategory, success, clearSelection, doFetch])

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return
    const validIds = selectedIds.filter(id => subCategories.some(sc => sc.id === id))
    if (validIds.length === 0) { toastError('Sub-kategori yang dipilih sudah tidak tersedia'); clearSelection(); return }

    setConfirm({
      open: true,
      title: 'Hapus Beberapa Sub-Kategori',
      message: `Hapus ${validIds.length} sub-kategori? Tindakan ini tidak dapat dibatalkan.`,
      action: async () => {
        await bulkDeleteSubCategories(validIds)
        success(`${validIds.length} sub-kategori berhasil dihapus`)
        clearSelection()
        doFetch(1)
      },
    })
  }, [selectedCount, selectedIds, subCategories, bulkDeleteSubCategories, success, toastError, clearSelection, doFetch])

  const handleBulkRestore = useCallback(() => {
    if (selectedCount === 0) return
    const validIds = selectedIds.filter(id => subCategories.some(sc => sc.id === id))
    if (validIds.length === 0) { toastError('Sub-kategori yang dipilih sudah tidak tersedia'); clearSelection(); return }

    setConfirm({
      open: true,
      title: 'Restore Beberapa Sub-Kategori',
      message: `Restore ${validIds.length} sub-kategori?`,
      action: async () => {
        for (const id of validIds) await restoreSubCategory(id)
        success(`${validIds.length} sub-kategori berhasil direstore`)
        clearSelection()
        doFetch(1)
      },
    })
  }, [selectedCount, selectedIds, subCategories, restoreSubCategory, success, toastError, clearSelection, doFetch])

  const handleConfirm = useCallback(async () => {
    if (!confirm || isConfirming) return
    setIsConfirming(true)
    try {
      await confirm.action()
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Terjadi kesalahan')
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
      return [{ label: 'Restore', onClick: handleBulkRestore, className: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700' }]
    }
    return [{ label: 'Hapus', onClick: handleBulkDelete, className: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700' }]
  }, [deletedFilter, handleBulkDelete, handleBulkRestore])

  const paginationInfo = useMemo(() => ({
    page: subPage, limit: subLimit, total: subTotal, totalPages: subTotalPages, hasNext: subHasNext, hasPrev: subHasPrev,
  }), [subPage, subLimit, subTotal, subTotalPages, subHasNext, subHasPrev])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderTree className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sub-Kategori</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{subTotal} total</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sub-categories/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Sub-Kategori
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari sub-kategori..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Semua Kategori</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.category_name}</option>
              ))}
            </select>
            <select
              value={deletedFilter}
              onChange={e => setDeletedFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="false">Item Aktif</option>
              <option value="true">Item Terhapus</option>
              <option value="">Semua Item</option>
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
        {error && !loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Terjadi Kesalahan</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
              <button onClick={() => doFetch(1)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Coba Lagi
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <SubCategoryTable
                subCategories={subCategories}
                loading={loading}
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

            {subTotal > 0 && !loading && (
              <Pagination
                pagination={paginationInfo}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                currentLength={subCategories.length}
                loading={loading}
              />
            )}
          </>
        )}
      </div>

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
