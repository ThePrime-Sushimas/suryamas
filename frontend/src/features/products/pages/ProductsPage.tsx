import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Plus, Search, X, Filter, RotateCcw, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { useProducts, useDeleteProduct, useRestoreProduct, useBulkDeleteProducts, useBulkRestoreProducts } from '../api/products.api'
import { useAllCategories, useSubCategories } from '@/features/categories/api/categories.api'
import { usePositions } from '@/features/settings/api/settings.api'
import type { Product } from '../types'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)

export default function ProductsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [subCategoryFilter, setSubCategoryFilter] = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [bulkAction, setBulkAction] = useState<'delete' | 'restore' | null>(null)
  const [sortBy, setSortBy] = useState<string>('product_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const debouncedSearch = useDebounce(search, 400)

  const { data: categories } = useAllCategories()
  const { data: subCategoriesData } = useSubCategories({ category_id: categoryFilter || undefined, limit: 500, is_active: 'true' })
  const subCategories = subCategoriesData?.data ?? []
  const { data: positions = [] } = usePositions()

  const queryParams = useMemo(() => ({
    page, limit, search: debouncedSearch || undefined,
    category_id: categoryFilter || undefined,
    sub_category_id: subCategoryFilter || undefined,
    station: stationFilter || undefined,
    includeDeleted: showDeleted || undefined,
    sort: sortBy, order: sortOrder,
  }), [page, limit, debouncedSearch, categoryFilter, subCategoryFilter, stationFilter, showDeleted, sortBy, sortOrder])

  const { data, isLoading } = useProducts(queryParams)
  const deleteProduct = useDeleteProduct()
  const restoreProduct = useRestoreProduct()
  const bulkDelete = useBulkDeleteProducts()
  const bulkRestore = useBulkRestoreProducts()

  const products = data?.data ?? []
  const pagination = data?.pagination

  const handleLimitChange = (newLimit: number) => { setLimit(newLimit); setPage(1) }
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const handleCategoryChange = (v: string) => { setCategoryFilter(v); setSubCategoryFilter(''); setPage(1) }
  const handleSubCategoryChange = (v: string) => { setSubCategoryFilter(v); setPage(1) }
  const handleStationChange = (v: string) => { setStationFilter(v); setPage(1) }
  const handleDeletedChange = (v: boolean) => { setShowDeleted(v); setPage(1) }
  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('asc') }
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteProduct.mutateAsync(deleteTarget.id)
      toast.success('Produk berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus produk')) }
    finally { setDeleteTarget(null) }
  }

  const handleRestore = async (id: string) => {
    try {
      await restoreProduct.mutateAsync(id)
      toast.success('Produk berhasil dipulihkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memulihkan produk')) }
  }

  const handleBulkAction = async () => {
    try {
      if (bulkAction === 'delete') {
        await bulkDelete.mutateAsync(selectedIds)
        toast.success(`${selectedIds.length} produk dihapus`)
      } else {
        await bulkRestore.mutateAsync(selectedIds)
        toast.success(`${selectedIds.length} produk dipulihkan`)
      }
      setSelectedIds([])
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memproses')) }
    finally { setBulkAction(null) }
  }

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  const toggleAll = () => setSelectedIds(prev => prev.length === products.length ? [] : products.map(p => p.id))

  const activeFilterCount = [categoryFilter, subCategoryFilter, stationFilter, showDeleted].filter(Boolean).length

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Produk</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <button onClick={() => navigate('/products/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Tambah Produk
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari nama atau kode..." value={search} onChange={e => handleSearchChange(e.target.value)}
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
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-3">
            <select value={categoryFilter} onChange={e => handleCategoryChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Kategori</option>
              {categories?.map(c => <option key={c.id} value={c.id}>{c.category_name}</option>)}
            </select>
            <select value={subCategoryFilter} onChange={e => handleSubCategoryChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Sub Kategori</option>
              {subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.sub_category_name}</option>)}
            </select>
            <select value={stationFilter} onChange={e => handleStationChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Station</option>
              {positions.filter(p => p.is_active).map(p => <option key={p.id} value={p.position_code}>{p.position_name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={showDeleted} onChange={e => handleDeletedChange(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 bg-white dark:bg-gray-700" />
              Tampilkan Terhapus
            </label>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="px-6 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-300">{selectedIds.length} dipilih</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds([])} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800">Clear</button>
            <button onClick={() => setBulkAction('delete')} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">Hapus</button>
            {showDeleted && <button onClick={() => setBulkAction('restore')} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">Pulihkan</button>}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th className="px-3 py-3 text-left w-10">
                    <input type="checkbox" checked={products.length > 0 && selectedIds.length === products.length} onChange={toggleAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 bg-white dark:bg-gray-700" />
                  </th>
                  <th onClick={() => handleSort('product_code')} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none">
                    Kode {sortBy === 'product_code' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('product_name')} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none">
                    Nama Produk {sortBy === 'product_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kategori</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sub Kategori</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Station</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Cost</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-3 py-12 text-center text-gray-400">Memuat...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-12 text-center text-gray-400">Tidak ada produk ditemukan</td></tr>
                ) : products.map(p => (
                  <tr key={p.id} onClick={() => navigate(`/products/${p.id}/edit`)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${p.is_deleted ? 'opacity-60 bg-red-50 dark:bg-red-900/10' : ''} ${selectedIds.includes(p.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 bg-white dark:bg-gray-700" />
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-900 dark:text-gray-200">{p.product_code}</td>
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                      {p.product_name}
                      {p.is_asset && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">AST</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{p.category_name || '—'}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{p.sub_category_name || '—'}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{p.station_name || '—'}</td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                      {p.average_cost > 0 ? (
                        <span>Rp {fmt(p.average_cost)}<span className="text-gray-400 text-xs ml-1">/{p.base_unit_name || '?'}</span></span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                      {p.is_deleted ? (
                        <button onClick={() => handleRestore(p.id)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                          <RotateCcw className="w-3.5 h-3.5 inline" /> Pulihkan
                        </button>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => navigate(`/products/${p.id}/uoms`)} className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400">UOMs</button>
                          <button onClick={() => navigate(`/products/${p.id}/edit`)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Edit</button>
                          <button onClick={() => setDeleteTarget(p)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {pagination && pagination.total > 0 && (
          <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={handleLimitChange} currentLength={products.length} loading={isLoading} />
        )}
      </div>

      {/* Delete Modal */}
      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Produk" message={`Yakin ingin menghapus "${deleteTarget?.product_name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteProduct.isPending} />

      {/* Bulk Modal */}
      <ConfirmModal isOpen={!!bulkAction} onClose={() => setBulkAction(null)} onConfirm={handleBulkAction}
        title={bulkAction === 'delete' ? 'Hapus Produk' : 'Pulihkan Produk'}
        message={`Yakin ingin ${bulkAction === 'delete' ? 'menghapus' : 'memulihkan'} ${selectedIds.length} produk?`}
        confirmText={bulkAction === 'delete' ? 'Hapus' : 'Pulihkan'}
        variant={bulkAction === 'delete' ? 'danger' : 'success'}
        isLoading={bulkDelete.isPending || bulkRestore.isPending} />
    </div>
  )
}
