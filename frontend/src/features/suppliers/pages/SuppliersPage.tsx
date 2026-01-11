import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSuppliersStore } from '../store/suppliers.store'
import { SupplierFilterBar } from '../components/SupplierFilterBar'
import { SupplierStatusBadge } from '../components/SupplierStatusBadge'
import { SupplierTypeBadge } from '../components/SupplierTypeBadge'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/_shared/useDebounce'
import type { SupplierType, SupplierListQuery } from '../types/supplier.types'

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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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

  const handleDelete = async (id: string) => {
    try {
      await deleteSupplier(id)
      toast.success('Supplier deleted successfully')
      setDeleteConfirm(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete supplier'
      toast.error(message)
    }
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        <p className="text-gray-600 mt-1">Manage your supplier database</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-700 hover:text-red-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {pagination && `${pagination.total} total suppliers`}
        </div>
        <button
          onClick={() => navigate('/suppliers/create')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('supplier_code')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Code {sortBy === 'supplier_code' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('supplier_name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Name {sortBy === 'supplier_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fetchLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No suppliers found
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr 
                    key={supplier.id} 
                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {supplier.supplier_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {supplier.supplier_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <SupplierTypeBadge type={supplier.supplier_type} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {supplier.contact_person}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {supplier.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {supplier.rating ? '⭐'.repeat(supplier.rating) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <SupplierStatusBadge isActive={supplier.is_active} />
                      {supplier.deleted_at && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
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
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
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
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm(supplier.id)
                            }}
                            disabled={mutationLoading}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
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

        {pagination && pagination.total > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(pagination.page * ITEMS_PER_PAGE, pagination.total)} of {pagination.total} suppliers
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={!pagination.hasPrev}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 border rounded-md bg-gray-50">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={!pagination.hasNext}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this supplier? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={mutationLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={mutationLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {mutationLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
