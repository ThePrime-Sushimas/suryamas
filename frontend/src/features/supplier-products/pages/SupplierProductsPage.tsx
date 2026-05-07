import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag, Plus, Search, X, Filter, Trash2, RotateCcw, Star, Download } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { useSupplierProducts, useDeleteSupplierProduct, useRestoreSupplierProduct, supplierProductsApi } from '../api/supplierProducts.api'
import { formatPrice } from '../utils/format'
import type { SupplierProductWithRelations, SupplierProductListQuery } from '../types/supplier-product.types'
import api from '@/lib/axios'

export function SupplierProductsPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [showFilter, setShowFilter] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [isPreferred, setIsPreferred] = useState<string>('')
  const [isActive, setIsActive] = useState<string>('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deleteTarget, setDeleteTarget] = useState<SupplierProductWithRelations | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<'delete' | 'restore' | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const query = useMemo((): SupplierProductListQuery => ({
    page, limit,
    search: debouncedSearch || undefined,
    supplier_id: supplierId || undefined,
    is_preferred: isPreferred ? isPreferred === 'true' : undefined,
    is_active: isActive ? isActive === 'true' : undefined,
    include_deleted: includeDeleted || undefined,
    sort_by: sortBy as SupplierProductListQuery['sort_by'],
    sort_order: sortOrder,
  }), [page, limit, debouncedSearch, supplierId, isPreferred, isActive, includeDeleted, sortBy, sortOrder])

  const { data, isLoading } = useSupplierProducts(query)
  const deleteSP = useDeleteSupplierProduct()
  const restoreSP = useRestoreSupplierProduct()

  const items = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('asc') }
    setPage(1)
  }

  const activeFilterCount = [supplierId, isPreferred, isActive, includeDeleted].filter(Boolean).length

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSP.mutateAsync(deleteTarget.id)
      toast.success('Produk supplier berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus')) }
    finally { setDeleteTarget(null) }
  }

  const handleRestore = async (id: string) => {
    try {
      await restoreSP.mutateAsync(id)
      toast.success('Produk supplier berhasil dipulihkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memulihkan')) }
  }

  const handleBulkAction = async () => {
    try {
      if (bulkAction === 'delete') {
        await api.post('/supplier-products/bulk/delete', { ids: selectedIds })
        toast.success(`${selectedIds.length} produk supplier dihapus`)
      } else {
        await api.post('/supplier-products/bulk/restore', { ids: selectedIds })
        toast.success(`${selectedIds.length} produk supplier dipulihkan`)
      }
      setSelectedIds([])
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memproses')) }
    finally { setBulkAction(null) }
  }

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  const toggleAll = () => setSelectedIds(prev => prev.length === items.length ? [] : items.map(i => i.id))

  const handleExport = async () => {
    try {
      const blob = await supplierProductsApi.exportCSV(query)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `supplier-products-${Date.now()}.csv`; a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Ekspor berhasil')
    } catch { toast.error('Gagal mengekspor') }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Produk Supplier</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              <Download className="w-3.5 h-3.5" /> Ekspor
            </button>
            <button onClick={() => navigate('/supplier-products/create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Tambah
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Cari supplier atau produk..." value={search} onChange={e => handleSearchChange(e.target.value)}
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
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select value={isPreferred} onChange={e => { setIsPreferred(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Preferensi</option>
              <option value="true">★ Preferred</option>
              <option value="false">Standar</option>
            </select>
            <select value={isActive} onChange={e => { setIsActive(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includeDeleted} onChange={e => { setIncludeDeleted(e.target.checked); setPage(1) }}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 bg-white dark:bg-gray-700" />
              Tampilkan Terhapus
            </label>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-b border-blue-200 dark:border-blue-800 px-6 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-300">{selectedIds.length} dipilih</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds([])} className="text-sm text-gray-600 dark:text-gray-400">Clear</button>
            {includeDeleted && <button onClick={() => setBulkAction('restore')} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">Pulihkan</button>}
            <button onClick={() => setBulkAction('delete')} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">Hapus</button>
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
                    <input type="checkbox" checked={items.length > 0 && selectedIds.length === items.length} onChange={toggleAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 bg-white dark:bg-gray-700" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit</th>
                  <th onClick={() => handleSort('price')} className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                    Harga {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('lead_time_days')} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                    Lead Time {sortBy === 'lead_time_days' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Preferred</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td className="px-3 py-4"></td>{Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                ) : items.length === 0 ? (
                  <tr><td></td><td colSpan={8} className="px-4 py-16 text-center">
                    <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Tidak ada produk supplier</p>
                  </td></tr>
                ) : items.map(sp => (
                  <tr key={sp.id} onClick={() => navigate(`/supplier-products/${sp.id}`)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${sp.deleted_at ? 'opacity-50 bg-red-50 dark:bg-red-900/10' : ''} ${selectedIds.includes(sp.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(sp.id)} onChange={() => toggleSelect(sp.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 bg-white dark:bg-gray-700" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{sp.supplier?.supplier_name || '—'}</p>
                      <p className="text-xs text-gray-400">{sp.supplier?.supplier_code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{sp.product?.product_name || '—'}</p>
                      <p className="text-xs text-gray-400">{sp.product?.product_code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                      {sp.current_unit || sp.product?.default_purchase_unit || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                      {sp.current_price ? formatPrice(sp.current_price, sp.current_currency || 'IDR') : formatPrice(sp.price, sp.currency)}
                      {sp.current_price && <p className="text-[10px] text-gray-400">From pricelist</p>}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                      {sp.lead_time_days ? `${sp.lead_time_days} hari` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sp.is_preferred ? <Star className="w-4 h-4 text-amber-500 mx-auto fill-amber-500" /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sp.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                        {sp.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      {sp.deleted_at ? (
                        <button onClick={() => handleRestore(sp.id)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                          <RotateCcw className="w-3.5 h-3.5 inline mr-1" />Pulihkan
                        </button>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => navigate(`/supplier-products/${sp.id}/pricelists`)} className="px-2 py-0.5 text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400">Harga</button>
                          <button onClick={() => navigate(`/supplier-products/${sp.id}/edit`)} className="px-2 py-0.5 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Edit</button>
                          <button onClick={() => setDeleteTarget(sp)} className="p-1 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.total > 0 && (
            <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={l => { setLimit(l); setPage(1) }} currentLength={items.length} loading={isLoading} />
          )}
        </div>
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Produk Supplier" message={`Yakin ingin menghapus produk "${deleteTarget?.product?.product_name}" dari "${deleteTarget?.supplier?.supplier_name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteSP.isPending} />

      <ConfirmModal isOpen={!!bulkAction} onClose={() => setBulkAction(null)} onConfirm={handleBulkAction}
        title={bulkAction === 'delete' ? 'Hapus Produk Supplier' : 'Pulihkan Produk Supplier'}
        message={`Yakin ingin ${bulkAction === 'delete' ? 'menghapus' : 'memulihkan'} ${selectedIds.length} produk supplier?`}
        confirmText={bulkAction === 'delete' ? 'Hapus' : 'Pulihkan'}
        variant={bulkAction === 'delete' ? 'danger' : 'success'} />
    </div>
  )
}
