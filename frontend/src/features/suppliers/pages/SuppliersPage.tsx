import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSuppliersStore } from '../store/suppliers.store'
import { SupplierFilterBar } from '../components/SupplierFilterBar'
import { SupplierStatusBadge } from '../components/SupplierStatusBadge'
import { SupplierTypeBadge } from '../components/SupplierTypeBadge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import type { SupplierType, SupplierListQuery } from '../types/supplier.types'
import { Plus, Eye, Pencil, Trash2, RotateCcw, PackageSearch, RefreshCw } from 'lucide-react'

const TABLE_COLS = 8

export function SuppliersPage() {
  const navigate = useNavigate()
  const { suppliers, pagination, fetchLoading, mutationLoading, error, fetchPage, deleteSupplier, restoreSupplier, clearError } = useSuppliersStore()
  const toast = useToast()
  
  const [search, setSearch] = useState('')
  const [supplierType, setSupplierType] = useState<SupplierType | ''>('')
  const [isActive, setIsActive] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [sortBy, setSortBy] = useState('supplier_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  const debouncedSearch = useDebounce(search, 500)

  const buildQuery = useCallback((): Omit<SupplierListQuery, 'page' | 'limit'> => {
    const q: Omit<SupplierListQuery, 'page' | 'limit'> = { sort_by: sortBy, sort_order: sortOrder }
    if (debouncedSearch) q.search = debouncedSearch
    if (supplierType) q.supplier_type = supplierType
    if (isActive) q.is_active = isActive === 'true'
    if (includeDeleted) q.include_deleted = true
    return q
  }, [debouncedSearch, supplierType, isActive, includeDeleted, sortBy, sortOrder])

  const doFetch = useCallback((page: number, limit?: number) => {
    fetchPage(page, limit, buildQuery())
  }, [fetchPage, buildQuery])

  // Search/filter/sort changes → reset to page 1 and fetch
  useEffect(() => {
    doFetch(1)
  }, [debouncedSearch, supplierType, isActive, includeDeleted, sortBy, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await deleteSupplier(deleteConfirm.id)
      toast.success('Supplier berhasil dihapus')
      setDeleteConfirm(null)
      doFetch(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus supplier')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await restoreSupplier(id)
      toast.success('Supplier berhasil dipulihkan')
      doFetch(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memulihkan supplier')
    }
  }

  const handleResetFilters = () => {
    setSearch('')
    setSupplierType('')
    setIsActive('')
    setIncludeDeleted(false)
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Suppliers</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Kelola database supplier</p>
      </div>

      {/* Error State with Retry */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4 flex justify-between items-center">
          <span>Terjadi kesalahan saat memuat data</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { clearError(); doFetch(pagination.page) }}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-red-100 dark:bg-red-800 rounded-lg hover:bg-red-200 dark:hover:bg-red-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Coba Lagi
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {`${pagination.total} total supplier`}
        </div>
        <button
          onClick={() => navigate('/suppliers/create')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Tambah Supplier
        </button>
      </div>

      <SupplierFilterBar
        search={search}
        supplierType={supplierType}
        isActive={isActive}
        includeDeleted={includeDeleted}
        onSearchChange={setSearch}
        onSupplierTypeChange={setSupplierType}
        onIsActiveChange={setIsActive}
        onIncludeDeletedChange={setIncludeDeleted}
        onReset={handleResetFilters}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th
                  onClick={() => handleSort('supplier_code')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Kode {sortBy === 'supplier_code' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('supplier_name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Nama {sortBy === 'supplier_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Kontak
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Telepon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {fetchLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: TABLE_COLS }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS} className="px-6 py-16 text-center">
                    <PackageSearch className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Tidak ada supplier ditemukan</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Coba ubah filter atau tambah supplier baru</p>
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr 
                    key={supplier.id} 
                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {supplier.supplier_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {supplier.supplier_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <SupplierTypeBadge type={supplier.supplier_type} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {supplier.contact_person}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {supplier.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {supplier.rating ? '⭐'.repeat(supplier.rating) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <SupplierStatusBadge isActive={supplier.is_active} />
                      {supplier.deleted_at && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                          Dihapus
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        {supplier.deleted_at ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRestore(supplier.id) }}
                            disabled={mutationLoading}
                            title="Pulihkan"
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/suppliers/${supplier.id}`) }}
                              title="Lihat"
                              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/suppliers/${supplier.id}/edit`) }}
                              title="Edit"
                              className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: supplier.id, name: supplier.supplier_name }) }}
                              disabled={mutationLoading}
                              title="Hapus"
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.total > 0 && (
          <Pagination
            pagination={pagination}
            onPageChange={(p) => doFetch(p)}
            onLimitChange={(l) => doFetch(1, l)}
            currentLength={suppliers.length}
            loading={fetchLoading}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Supplier"
        message={`Apakah Anda yakin ingin menghapus "${deleteConfirm?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        isLoading={mutationLoading}
      />
    </div>
  )
}
