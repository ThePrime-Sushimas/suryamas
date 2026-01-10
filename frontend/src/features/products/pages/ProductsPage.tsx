import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../store/products.store'
import { ProductTable } from '../components/ProductTable'
import { ProductDeleteDialog } from '../components/ProductDeleteDialog'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/useDebounce'
import { Package, Plus, Search, Filter, X } from 'lucide-react'

export default function ProductsPage() {
  const navigate = useNavigate()
  const {
    products,
    pagination,
    fetchLoading,
    mutationLoading,
    error: storeError,
    selectedIds,
    fetchProducts,
    searchProducts,
    deleteProduct,
    bulkDelete,
    bulkRestore,
    restoreProduct,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    clearError
  } = useProductsStore()

  const { success, error: showError } = useToast()
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [showDeletedFilter, setShowDeletedFilter] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkRestoreDialogOpen, setBulkRestoreDialogOpen] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  
  const debouncedSearch = useDebounce(search, 500)

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilter) count++
    if (typeFilter) count++
    if (showDeletedFilter) count++
    return count
  }, [statusFilter, typeFilter, showDeletedFilter])

  const loadProducts = useCallback((page: number = 1) => {
    const filter: Record<string, string> = {}
    if (statusFilter) filter.status = statusFilter
    if (typeFilter) filter.product_type = typeFilter
    
    const filterObj = Object.keys(filter).length > 0 ? filter : undefined
    
    if (debouncedSearch) {
      searchProducts(debouncedSearch, page, pagination.limit, showDeletedFilter)
    } else {
      fetchProducts(page, pagination.limit, undefined, filterObj, showDeletedFilter)
    }
  }, [debouncedSearch, statusFilter, typeFilter, pagination.limit, fetchProducts, searchProducts, showDeletedFilter])

  useEffect(() => {
    loadProducts(1)
  }, [debouncedSearch, statusFilter, typeFilter, showDeletedFilter, loadProducts])

  useEffect(() => {
    if (storeError) {
      showError(storeError)
      clearError()
    }
  }, [storeError, showError, clearError])

  const handleDelete = async (id: string) => {
    const product = products.find(p => p.id === id)
    if (!product) return
    
    setProductToDelete({ id, name: product.product_name })
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!productToDelete) return

    try {
      await deleteProduct(productToDelete.id)
      success('Product deleted successfully')
      setDeleteDialogOpen(false)
      setProductToDelete(null)
      loadProducts(pagination.page)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await restoreProduct(id)
      success('Product restored successfully')
      loadProducts(pagination.page)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to restore product')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      showError('Please select products to delete')
      return
    }

    setBulkDeleteDialogOpen(true)
  }

  const confirmBulkDelete = async () => {
    try {
      await bulkDelete(selectedIds)
      success(`${selectedIds.length} product(s) deleted successfully`)
      setBulkDeleteDialogOpen(false)
      loadProducts(pagination.page)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete products')
    }
  }

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) {
      showError('Please select products to restore')
      return
    }

    setBulkRestoreDialogOpen(true)
  }

  const confirmBulkRestore = async () => {
    try {
      await bulkRestore(selectedIds)
      success(`${selectedIds.length} product(s) restored successfully`)
      setBulkRestoreDialogOpen(false)
      loadProducts(pagination.page)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to restore products')
    }
  }

  const handlePageChange = (newPage: number) => {
    loadProducts(newPage)
  }

  const hasDeletedSelected = selectedIds.some(id => products.find(p => p.id === id)?.is_deleted)

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Products</h1>
              <p className="text-sm text-gray-500">{pagination.total} total</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/products/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors ${
              showFilter ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="DISCONTINUED">Discontinued</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="">All Types</option>
                  <option value="raw">Raw Material</option>
                  <option value="semi_finished">Semi-Finished</option>
                  <option value="finished_goods">Finished Goods</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDeletedFilter}
                    onChange={e => setShowDeletedFilter(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Show Deleted</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedIds.length} product(s) selected
            </span>
            <div className="space-x-2">
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
              {hasDeletedSelected ? (
                <button
                  onClick={handleBulkRestore}
                  disabled={mutationLoading}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-400 transition"
                >
                  {mutationLoading ? 'Restoring...' : 'Restore Selected'}
                </button>
              ) : (
                <button
                  onClick={handleBulkDelete}
                  disabled={mutationLoading}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:bg-gray-400 transition"
                >
                  {mutationLoading ? 'Deleting...' : 'Delete Selected'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {fetchLoading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-gray-500">Loading products...</p>
            </div>
          </div>
        ) : (
          <>
            <ProductTable
              products={products}
              selectedIds={selectedIds}
              deletingId={mutationLoading && productToDelete ? productToDelete.id : null}
              onView={id => navigate(`/products/${id}`)}
              onEdit={id => navigate(`/products/${id}/edit`)}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onManageUoms={id => navigate(`/products/${id}/uoms`)}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
            />

            {/* Pagination */}
            {pagination.total > 0 && (
              <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow-sm px-4 py-3">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} products
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrev}
                    className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 border rounded-md bg-gray-50">
                    Page {pagination.page} of {pagination.totalPages || 1}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNext}
                    className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Dialogs */}
      {productToDelete && (
        <ProductDeleteDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false)
            setProductToDelete(null)
          }}
          onConfirm={confirmDelete}
          productName={productToDelete.name}
          isLoading={mutationLoading}
        />
      )}

      <ConfirmModal
        isOpen={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Products"
        message={`Are you sure you want to delete ${selectedIds.length} product(s)? This action can be reversed later.`}
        confirmText="Delete"
        variant="danger"
        isLoading={mutationLoading}
      />

      <ConfirmModal
        isOpen={bulkRestoreDialogOpen}
        onClose={() => setBulkRestoreDialogOpen(false)}
        onConfirm={confirmBulkRestore}
        title="Restore Products"
        message={`Are you sure you want to restore ${selectedIds.length} product(s)?`}
        confirmText="Restore"
        variant="success"
        isLoading={mutationLoading}
      />
    </div>
  )
}
