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
import { Plus } from 'lucide-react'

const ITEMS_PER_PAGE = 10

export function SuppliersPage() {
  const navigate = useNavigate()
  const { suppliers, pagination, fetchLoading, mutationLoading, error, fetchSuppliers, deleteSupplier, restoreSupplier, clearError } = useSuppliersStore()
  const toast = useToast()
  
  const [search, setSearch] = useState('')
  const [supplierType, setSupplierType] = useState<SupplierType | ''>('')
  const [isActive, setIsActive] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('supplier_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  const debouncedSearch = useDebounce(search, 500)

  const loadSuppliers = useCallback((signal?: AbortSignal) => {
    const query: SupplierListQuery = {
      page,
      limit: ITEMS_PER_PAGE,
      sort_by: sortBy,
      sort_order: sortOrder,
    }
    
    if (debouncedSearch) query.search = debouncedSearch
    if (supplierType) query.supplier_type = supplierType
    if (isActive) query.is_active = isActive === 'true'
    if (includeDeleted) query.include_deleted = true
    
    fetchSuppliers(query, signal)
  }, [page, sortBy, sortOrder, debouncedSearch, supplierType, isActive, includeDeleted, fetchSuppliers])

  // Reset page when filters change
  useEffect(() => {
    if (page !== 1) {
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierType, isActive, debouncedSearch, includeDeleted])

  useEffect(() => {
    const controller = new AbortController()
    loadSuppliers(controller.signal)
    return () => controller.abort()
  }, [loadSuppliers])

  const handleDeleteClick = (supplier: { id: string; supplier_name: string }) => {
    setDeleteConfirm({ id: supplier.id, name: supplier.supplier_name })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await deleteSupplier(deleteConfirm.id)
      toast.success('Supplier deleted successfully')
      setDeleteConfirm(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete supplier'
      toast.error(message)
    }
  }

  const handleCloseDeleteModal = () => {
    setDeleteConfirm(null)
  }

  const handleRestore = async (id: string) => {
    try {
      await restoreSupplier(id)
      toast.success('Supplier restored successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore supplier'
      toast.error(message)
    }
  }

  const handleResetFilters = () => {
    setSearch('')
    setSupplierType('')
    setIsActive('')
    setIncludeDeleted(false)
    setPage(1)
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
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your supplier database</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {pagination && `${pagination.total} total suppliers`}
        </div>
        <button
          onClick={() => navigate('/suppliers/create')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Supplier
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th
                  onClick={() => handleSort('supplier_code')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Code {sortBy === 'supplier_code' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('supplier_name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Name {sortBy === 'supplier_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {fetchLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No suppliers found
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
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                          Deleted
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {supplier.deleted_at ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestore(supplier.id)
                          }}
                          disabled={mutationLoading}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 disabled:opacity-50"
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/suppliers/${supplier.id}/edit`)
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(supplier)
                            }}
                            disabled={mutationLoading}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Global Pagination Component */}
        {pagination && pagination.total > 0 && (
          <Pagination
            pagination={{
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              totalPages: pagination.totalPages,
              hasNext: pagination.hasNext,
              hasPrev: pagination.hasPrev
            }}
            onPageChange={setPage}
            onLimitChange={() => {}}
            currentLength={suppliers.length}
            loading={fetchLoading}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={mutationLoading}
      />
    </div>
  )
}

