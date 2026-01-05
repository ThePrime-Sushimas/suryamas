import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../store/products.store'
import { ProductTable } from '../components/ProductTable'
import { useToast } from '@/contexts/ToastContext'
import { useDebounce } from '@/hooks/useDebounce'

export default function ProductsPage() {
  const navigate = useNavigate()
  const {
    products,
    pagination,
    loading,
    selectedIds,
    fetchProducts,
    searchProducts,
    deleteProduct,
    bulkDelete,
    toggleSelect,
    toggleSelectAll,
    clearSelection
  } = useProductsStore()

  const { success, error: showError } = useToast()
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  
  const debouncedSearch = useDebounce(search, 500)

  const loadProducts = useCallback((page: number = 1) => {
    const filter = statusFilter ? { status: statusFilter } : undefined
    
    if (debouncedSearch) {
      searchProducts(debouncedSearch, page, pagination.limit)
    } else {
      fetchProducts(page, pagination.limit, undefined, filter)
    }
  }, [debouncedSearch, statusFilter, pagination.limit, fetchProducts, searchProducts])

  useEffect(() => {
    loadProducts(1)
  }, [debouncedSearch, statusFilter, loadProducts])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return
    }

    setDeleting(id)
    try {
      await deleteProduct(id)
      success('Product deleted successfully')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete product')
    } finally {
      setDeleting(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      showError('Please select products to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} product(s)? This action cannot be undone.`)) {
      return
    }

    setBulkDeleting(true)
    try {
      await bulkDelete(selectedIds)
      success(`${selectedIds.length} product(s) deleted successfully`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete products')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    loadProducts(newPage)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <button
          onClick={() => navigate('/products/create')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DISCONTINUED">Discontinued</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between bg-blue-50 p-3 rounded-md">
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
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:bg-gray-400 transition"
              >
                {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {loading && !deleting ? (
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
            deletingId={deleting}
            onView={id => navigate(`/products/${id}`)}
            onEdit={id => navigate(`/products/${id}/edit`)}
            onDelete={handleDelete}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} products
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 border rounded-md ${
                        pagination.page === page
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                {pagination.totalPages > 5 && <span className="px-2">...</span>}
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
