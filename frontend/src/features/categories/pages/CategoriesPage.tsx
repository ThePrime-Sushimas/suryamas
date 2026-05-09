import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Search, Filter, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import Pagination from '@/components/ui/Pagination'
import { useCategories, useDeleteCategory, useRestoreCategory, useUpdateCategoryStatus } from '../api/categories.api'
import { CategoryTable } from '../components/CategoryTable'
import type { Category } from '../types'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [statusFilter, setStatusFilter] = useState('')
  const [deletedFilter, setDeletedFilter] = useState('false')
  const [showFilter, setShowFilter] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Category | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const queryParams = useMemo(() => ({
    page, limit, search: debouncedSearch || undefined,
    is_active: statusFilter || undefined,
    is_deleted: deletedFilter !== 'false' ? deletedFilter : undefined,
    sort: 'sort_order',
    order: 'asc',
  }), [page, limit, debouncedSearch, statusFilter, deletedFilter])

  const { data, isLoading } = useCategories(queryParams)
  const deleteCategory = useDeleteCategory()
  const restoreCategory = useRestoreCategory()
  const updateStatus = useUpdateCategoryStatus()

  const categories = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const activeFilterCount = (statusFilter ? 1 : 0) + (deletedFilter !== 'false' ? 1 : 0)

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCategory.mutateAsync(deleteTarget.id)
      toast.success('Kategori berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus kategori')) }
    finally { setDeleteTarget(null) }
  }

  const handleConfirmRestore = async () => {
    if (!restoreTarget) return
    try {
      await restoreCategory.mutateAsync(restoreTarget.id)
      toast.success('Kategori berhasil dipulihkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memulihkan kategori')) }
    finally { setRestoreTarget(null) }
  }

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      await updateStatus.mutateAsync({ id, is_active: !isActive })
      toast.success(`Kategori ${!isActive ? 'diaktifkan' : 'dinonaktifkan'}`)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal mengubah status')) }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Kategori</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/categories/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Tambah Kategori
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari kategori..." value={search} onChange={e => handleSearchChange(e.target.value)}
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
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
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
          <CategoryTable categories={categories} loading={isLoading}
            onView={id => navigate(`/categories/${id}/edit`)}
            onEdit={id => navigate(`/categories/${id}/edit`)}
            onDelete={(id, name) => setDeleteTarget({ id, category_name: name } as Category)}
            onRestore={(id, name) => setRestoreTarget({ id, category_name: name } as Category)}
            onToggleStatus={handleToggleStatus}
            showDeleted={deletedFilter === 'true'} />
        </div>
        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={l => { setLimit(l); setPage(1) }} currentLength={categories.length} loading={isLoading} />
        )}
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete}
        title="Hapus Kategori" message={`Yakin ingin menghapus "${deleteTarget?.category_name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteCategory.isPending} />
      <ConfirmModal isOpen={!!restoreTarget} onClose={() => setRestoreTarget(null)} onConfirm={handleConfirmRestore}
        title="Pulihkan Kategori" message={`Yakin ingin memulihkan "${restoreTarget?.category_name}"?`}
        confirmText="Pulihkan" variant="success" isLoading={restoreCategory.isPending} />
    </div>
  )
}
