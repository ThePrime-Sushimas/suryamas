// Supplier Products Page - Main list page

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useSupplierProductsStore } from '../store/supplierProducts.store'
import { SupplierProductTable } from '../components/SupplierProductTable'
import { SupplierProductFilters } from '../components/SupplierProductFilters'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { supplierProductsApi } from '../api/supplierProducts.api'
import type { SupplierProductListQuery } from '../types/supplier-product.types'

export function SupplierProductsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  
  // Individual selectors (recommended pattern)
  const supplierProducts = useSupplierProductsStore(s => s.supplierProducts)
  const pagination = useSupplierProductsStore(s => s.pagination)
  const fetchLoading = useSupplierProductsStore(s => s.fetchLoading)
  const mutationLoading = useSupplierProductsStore(s => s.mutationLoading)
  const error = useSupplierProductsStore(s => s.error)
  const selectedItems = useSupplierProductsStore(s => s.selectedItems)
  const fetchSupplierProducts = useSupplierProductsStore(s => s.fetchSupplierProducts)
  const deleteSupplierProduct = useSupplierProductsStore(s => s.deleteSupplierProduct)
  const restoreSupplierProduct = useSupplierProductsStore(s => s.restoreSupplierProduct)
  const bulkDeleteSupplierProducts = useSupplierProductsStore(s => s.bulkDeleteSupplierProducts)
  const bulkRestoreSupplierProducts = useSupplierProductsStore(s => s.bulkRestoreSupplierProducts)
  const setSelectedItems = useSupplierProductsStore(s => s.setSelectedItems)
  const clearError = useSupplierProductsStore(s => s.clearError)
  const reset = useSupplierProductsStore(s => s.reset)

  // Confirm modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)

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

  // Cleanup on unmount
  useEffect(() => {
    return () => reset()
  }, [reset])

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

  const handleDeleteClick = useCallback((id: string) => {
    setItemToDelete(id)
    setDeleteModalOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!itemToDelete) return
    try {
      await deleteSupplierProduct(itemToDelete)
      toast.success('Supplier product deleted successfully')
    } catch {
      // Error handled in store
    } finally {
      setDeleteModalOpen(false)
      setItemToDelete(null)
    }
  }, [itemToDelete, deleteSupplierProduct, toast])

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) return
    setBulkDeleteModalOpen(true)
  }, [selectedItems])

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (selectedItems.length === 0) return
    try {
      await bulkDeleteSupplierProducts(selectedItems)
      toast.success(`${selectedItems.length} supplier products deleted successfully`)
    } catch {
      // Error handled in store
    } finally {
      setBulkDeleteModalOpen(false)
    }
  }, [selectedItems, bulkDeleteSupplierProducts, toast])

  const handleManagePrices = useCallback((id: string) => {
    navigate(`/supplier-products/${id}/pricelists`)
  }, [navigate])

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
    try {
      await bulkRestoreSupplierProducts(selectedItems)
      toast.success(`${selectedItems.length} supplier products restored successfully`)
    } catch {
      // Error handled in store
    }
  }, [selectedItems, bulkRestoreSupplierProducts, toast])

  const handleExport = useCallback(async () => {
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
  }, [filters, toast])

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Supplier Products</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage supplier product pricing and preferences</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 dark:bg-green-600 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-500"
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
        onReset={handleResetFilters}
        includeDeleted={filters.include_deleted || false}
        onIncludeDeletedChange={(value) => setFilters(prev => ({ ...prev, include_deleted: value, page: 1 }))}
      />

      {/* Bulk Actions */}
      {selectedItems.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4 flex justify-between items-center">
          <span className="text-sm font-medium text-green-800 dark:text-green-300">
            {selectedItems.length} item(s) selected
          </span>
          <div className="flex gap-2">
            {filters.include_deleted && (
              <button
                onClick={handleBulkRestore}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                Bulk Restore
              </button>
            )}
            <button
              onClick={handleBulkDeleteClick}
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
        onDelete={handleDeleteClick}
        onView={handleView}
        onRestore={handleRestore}
        onManagePrices={handleManagePrices}
        sortBy={filters.sort_by}
        sortOrder={filters.sort_order}
        onSort={handleSort}
      />

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="mt-6">
          <Pagination
            pagination={{
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              totalPages: pagination.totalPages,
              hasNext: pagination.hasNext,
              hasPrev: pagination.hasPrev
            }}
            onPageChange={handlePageChange}
            onLimitChange={handlePageSizeChange}
            currentLength={supplierProducts.length}
            loading={fetchLoading}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Supplier Product"
        message="Are you sure you want to delete this supplier product? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={mutationLoading}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title="Bulk Delete Supplier Products"
        message={`Are you sure you want to delete ${selectedItems.length} supplier products? This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
        isLoading={mutationLoading}
      />

      {/* Loading Overlay */}
      {mutationLoading && (
        <div className="fixed inset-0 bg-gray-900/20 dark:bg-gray-900/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Processing...</p>
          </div>
        </div>
      )}
    </div>
  )
}

