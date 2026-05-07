import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderTree, Plus, Search, Filter, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'
import { useSubCategories, useAllCategories, useDeleteSubCategory, useRestoreSubCategory } from '../api/categories.api'
import { SubCategoryTable } from '../components/SubCategoryTable'
import type { SubCategory } from '../types'

export default function SubCategoriesPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [deletedFilter, setDeletedFilter] = useState('false')
  const [showFilter, setShowFilter] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; name: string } | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const queryParams = useMemo(() => ({
    page, limit, search: debouncedSearch || undefined,
    category_id: categoryFilter || undefined,
    is_deleted: deletedFilter !== 'false' ? deletedFilter : undefined,
  }), [page, limit, debouncedSearch, categoryFilter, deletedFilter])

  const { data, isLoading } = useSubCategories(queryParams)
  const { data: categories = [] } = useAllCategories()
  const deleteSub = useDeleteSubCategory()
  const restoreSub = useRestoreSubCategory()

  const subCategories = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const activeFilterCount = (categoryFilter ? 1 : 0) + (deletedFilter !== 'false' ? 1 : 0)

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSub.mutateAsync(deleteTarget.id)
      toast.success('Sub-kategori berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus sub-kategori')) }
    finally { setDeleteTarget(null) }
  }

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return
    try {
      await restoreSub.mutateAsync(restoreTarget.id)
      toast.success('Sub-kategori berhasil dipulihkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memulihkan sub-kategori')) }
    finally { setRestoreTarget(null) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderTree className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sub-Kategori</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/sub-categories/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Tambah Sub-Kategori
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari sub-kategori..." value={search} onChange={e => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            {search && <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <button onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 ${showFilter ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">{activeFilterCount}</span>}
          </button>
        </div>
        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Kategori</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
            </select>
            <select value={deletedFilter} onChange={e => { setDeletedFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="false">Item Aktif</option>
              <option value="true">Item Terhapus</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <SubCategoryTable subCategories={subCategories} loading={isLoading}
            onView={id => navigate(`/sub-categories/${id}/edit`)}
            onEdit={id => navigate(`/sub-categories/${id}/edit`)}
            onDelete={(id, name) => setDeleteTarget({ id, name })}
            onRestore={(id, name) => setRestoreTarget({ id, name })}
            showDeleted={deletedFilter === 'true'} />
        </div>
        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={l => { setLimit(l); setPage(1) }} currentLength={subCategories.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete}
        title="Hapus Sub-Kategori" message={`Yakin ingin menghapus "${deleteTarget?.name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteSub.isPending} />
      <ConfirmModal isOpen={!!restoreTarget} onClose={() => setRestoreTarget(null)} onConfirm={handleConfirmRestore}
        title="Pulihkan Sub-Kategori" message={`Yakin ingin memulihkan "${restoreTarget?.name}"?`}
        confirmText="Pulihkan" variant="success" isLoading={restoreSub.isPending} />
    </div>
  )
}
