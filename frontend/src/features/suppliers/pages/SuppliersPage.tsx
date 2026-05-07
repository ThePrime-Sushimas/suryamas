import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, X, Filter, Trash2, RotateCcw, Pencil, PackageSearch } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { useSuppliers, useDeleteSupplier, useRestoreSupplier } from '../api/suppliers.api'
import { SupplierTypeBadge } from '../components/SupplierTypeBadge'
import { SupplierStatusBadge } from '../components/SupplierStatusBadge'
import type { Supplier, SupplierType } from '../types/supplier.types'

export function SuppliersPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [supplierType, setSupplierType] = useState<SupplierType | ''>('')
  const [isActive, setIsActive] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [sortBy, setSortBy] = useState('supplier_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showFilter, setShowFilter] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const query = useMemo(() => ({
    page, limit, search: debouncedSearch || undefined,
    supplier_type: supplierType || undefined,
    is_active: isActive ? isActive === 'true' : undefined,
    include_deleted: includeDeleted || undefined,
    sort_by: sortBy, sort_order: sortOrder,
  }), [page, limit, debouncedSearch, supplierType, isActive, includeDeleted, sortBy, sortOrder])

  const { data, isLoading } = useSuppliers(query)
  const deleteSupplier = useDeleteSupplier()
  const restoreSupplier = useRestoreSupplier()

  const suppliers = data?.data ?? []
  const pagination = data?.pagination

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('asc') }
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSupplier.mutateAsync(deleteTarget.id)
      toast.success('Supplier berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus supplier')) }
    finally { setDeleteTarget(null) }
  }

  const handleRestore = async (id: string) => {
    try {
      await restoreSupplier.mutateAsync(id)
      toast.success('Supplier berhasil dipulihkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memulihkan supplier')) }
  }

  const activeFilterCount = [supplierType, isActive, includeDeleted].filter(Boolean).length

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Supplier</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} total</p>
          </div>
          <button onClick={() => navigate('/suppliers/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Tambah Supplier
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
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={supplierType} onChange={e => { setSupplierType(e.target.value as SupplierType | ''); setPage(1) }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Semua Tipe</option>
              <option value="vegetables">Sayuran</option>
              <option value="meat">Daging</option>
              <option value="seafood">Seafood</option>
              <option value="dairy">Dairy</option>
              <option value="beverage">Minuman</option>
              <option value="dry_goods">Bahan Kering</option>
              <option value="packaging">Packaging</option>
              <option value="other">Lainnya</option>
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

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th onClick={() => handleSort('supplier_code')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                    Kode {sortBy === 'supplier_code' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('supplier_name')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                    Nama {sortBy === 'supplier_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kontak</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Telepon</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-16 text-center">
                    <PackageSearch className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Tidak ada supplier ditemukan</p>
                  </td></tr>
                ) : suppliers.map(s => (
                  <tr key={s.id} onClick={() => navigate(`/suppliers/${s.id}/edit`)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${s.deleted_at ? 'opacity-60 bg-red-50 dark:bg-red-900/10' : ''}`}>
                    <td className="px-4 py-3 font-mono text-gray-900 dark:text-gray-200">{s.supplier_code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.supplier_name}</td>
                    <td className="px-4 py-3"><SupplierTypeBadge type={s.supplier_type} /></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.contact_person}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.phone}</td>
                    <td className="px-4 py-3 text-center">
                      <SupplierStatusBadge isActive={s.is_active} />
                      {s.deleted_at && <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">DEL</span>}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      {s.deleted_at ? (
                        <button onClick={() => handleRestore(s.id)} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">
                          <RotateCcw className="w-3.5 h-3.5 inline mr-1" />Pulihkan
                        </button>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => navigate(`/suppliers/${s.id}/edit`)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded">
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
            <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={l => { setLimit(l); setPage(1) }} currentLength={suppliers.length} loading={isLoading} />
          )}
        </div>
      </div>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Supplier" message={`Yakin ingin menghapus "${deleteTarget?.supplier_name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteSupplier.isPending} />
    </div>
  )
}
