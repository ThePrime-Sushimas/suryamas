// Supplier Products Page - Main list page

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useSupplierProductsStore } from '../store/supplierProducts.store'
import { SupplierProductTable } from '../components/SupplierProductTable'
import { SupplierProductFilters } from '../components/SupplierProductFilters'
import { supplierProductsApi } from '../api/supplierProducts.api'
import type { SupplierProductListQuery } from '../types/supplier-product.types'

export function SupplierProductsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const {
    supplierProducts,
    pagination,
    fetchLoading,
    mutationLoading,
    error,
    selectedItems,
    fetchSupplierProducts,
    deleteSupplierProduct,
    restoreSupplierProduct,
    bulkDeleteSupplierProducts,
    bulkRestoreSupplierProducts,
    setSelectedItems,
    clearError
  } = useSupplierProductsStore()

  // Filter states
  const [filters, setFilters] = useState<SupplierProductListQuery>({
    page: 1,
    limit: 10,
    search: '',
    supplier_id: '',
    product_id: '',
    is_preferred: undefined,
    is_active: undefined,
    include_deleted: false,
    sort_by: 'created_at',
    sort_order: 'desc'
  })

  // Load data on mount and filter change
  useEffect(() => {
    const controller = new AbortController()
    fetchSupplierProducts(filters, controller.signal)
    return () => controller.abort()
  }, [fetchSupplierProducts, filters])

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, toast, clearError])

  // Filter handlers
  const handleSearchChange = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, search: value || '', page: 1 }))
  }, [])

  const handleSupplierChange = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, supplier_id: value || '', page: 1 }))
  }, [])

  const handleProductChange = useCallback((value: string) => {
    setFilters(prev => ({ ...prev, product_id: value || '', page: 1 }))
  }, [])

  const handlePreferredChange = useCallback((value: boolean | undefined) => {
    setFilters(prev => ({ ...prev, is_preferred: value, page: 1 }))
  }, [])

  const handleActiveChange = useCallback((value: boolean | undefined) => {
    setFilters(prev => ({ ...prev, is_active: value, page: 1 }))
  }, [])

  const handlePageSizeChange = useCallback((value: number) => {
    setFilters(prev => ({ ...prev, limit: value, page: 1 }))
  }, [])

  const handleResetFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 10,
      search: '',
      supplier_id: '',
      product_id: '',
      is_preferred: undefined,
      is_active: undefined,
      include_deleted: false,
      sort_by: 'created_at',
      sort_order: 'desc'
    })
  }, [])

  const handleSort = useCallback((field: string) => {
    setFilters(prev => ({
      ...prev,
      sort_by: field as 'price' | 'lead_time_days' | 'min_order_qty' | 'created_at' | 'updated_at',
      sort_order: prev.sort_by === field && prev.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1
    }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }, [])

  // Selection handlers
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedItems(supplierProducts.map(sp => sp.id))
    } else {
      setSelectedItems([])
    }
  }, [supplierProducts, setSelectedItems])

  const handleSelectItem = useCallback((id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, id])
    } else {
      setSelectedItems(selectedItems.filter(itemId => itemId !== id))
    }
  }, [selectedItems, setSelectedItems])

  // Action handlers
  const handleEdit = useCallback((id: string) => {
    navigate(`/supplier-products/${id}/edit`)
  }, [navigate])

  const handleView = useCallback((id: string) => {
    navigate(`/supplier-products/${id}`)
  }, [navigate])

  const handleDelete = useCallback(async (id: string) => {
    if (window.confirm('Are you sure you want to delete this supplier product?')) {
      try {
        await deleteSupplierProduct(id)
        toast.success('Supplier product deleted successfully')
      } catch {
        // Error handled in store
      }
    }
  }, [deleteSupplierProduct, toast])

  const handleBulkDelete = useCallback(async () => {
    if (selectedItems.length === 0) return

    if (window.confirm(`Are you sure you want to delete ${selectedItems.length} supplier products?`)) {
      try {
        await bulkDeleteSupplierProducts(selectedItems)
        toast.success(`${selectedItems.length} supplier products deleted successfully`)
      } catch {
        // Error handled in store
      }
    }
  }, [selectedItems, bulkDeleteSupplierProducts, toast])

  const handleRestore = useCallback(async (id: string) => {
    try {
      await restoreSupplierProduct(id)
      toast.success('Supplier product restored successfully')
    } catch {
      // Error handled in store
    }
  }, [restoreSupplierProduct, toast])

  const handleBulkRestore = useCallback(async () => {
    if (selectedItems.length === 0) return

    if (window.confirm(`Are you sure you want to restore ${selectedItems.length} supplier products?`)) {
      try {
        await bulkRestoreSupplierProducts(selectedItems)
        toast.success(`${selectedItems.length} supplier products restored successfully`)
      } catch {
        // Error handled in store
      }
    }
  }, [selectedItems, bulkRestoreSupplierProducts, toast])

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Products</h1>
          <p className="text-gray-500 mt-1">Manage supplier product pricing and preferences</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const blob = await supplierProductsApi.exportCSV(filters)
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `supplier-products-${Date.now()}.csv`
                a.click()
                window.URL.revokeObjectURL(url)
                toast.success('Export completed')
              } catch {
                toast.error('Export failed')
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Export CSV
          </button>
          <button
            onClick={() => navigate('/supplier-products/create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add New Supplier Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <SupplierProductFilters
        search={filters.search || ''}
        onSearchChange={handleSearchChange}
        supplierId={filters.supplier_id || ''}
        onSupplierChange={handleSupplierChange}
        productId={filters.product_id || ''}
        onProductChange={handleProductChange}
        isPreferred={filters.is_preferred}
        onPreferredChange={handlePreferredChange}
        isActive={filters.is_active}
        onActiveChange={handleActiveChange}
        pageSize={filters.limit || 10}
        onPageSizeChange={handlePageSizeChange}
        onReset={handleResetFilters}
        includeDeleted={filters.include_deleted || false}
        onIncludeDeletedChange={(value) => setFilters(prev => ({ ...prev, include_deleted: value, page: 1 }))}
      />

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex justify-between items-center">
          <span className="text-sm font-medium text-blue-800">
            {selectedItems.length} item(s) selected
          </span>
          <div className="flex gap-2">
            {filters.include_deleted && (
              <button
                onClick={handleBulkRestore}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
              >
                Bulk Restore
              </button>
            )}
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
            >
              Bulk Delete
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <SupplierProductTable
        data={supplierProducts}
        loading={fetchLoading}
        selectedItems={selectedItems}
        onSelectAll={handleSelectAll}
        onSelectItem={handleSelectItem}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        onRestore={handleRestore}
        sortBy={filters.sort_by}
        sortOrder={filters.sort_order}
        onSort={handleSort}
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>

          {/* Page numbers */}
          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
            let pageNum: number
            if (pagination.totalPages <= 5) {
              pageNum = i + 1
            } else if (pagination.page <= 3) {
              pageNum = i + 1
            } else if (pagination.page >= pagination.totalPages - 2) {
              pageNum = pagination.totalPages - 4 + i
            } else {
              pageNum = pagination.page - 2 + i
            }

            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 py-2 border rounded-md text-sm font-medium ${
                  pagination.page === pageNum
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            )
          })}

          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNext}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {mutationLoading && (
        <div className="fixed inset-0 bg-gray-900/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Processing...</p>
          </div>
        </div>
      )}
    </div>
  )
}

