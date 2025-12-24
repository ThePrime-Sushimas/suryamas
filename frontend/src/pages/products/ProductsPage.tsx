import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { productService } from '../../services/productService'
import { categoryService, subCategoryService } from '../../services/categoryService'
import { ProductTable } from '../../components/products/ProductTable'
import type { Product } from '../../types/product'
import { Plus, Search, Download, Upload, X, Filter, RefreshCw, Trash2 } from 'lucide-react'

export const ProductsPage = () => {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showDeleted, setShowDeleted] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [showDeleted])

  const loadData = async () => {
    try {
      setLoading(true)
      const [prodRes, catRes, subCatRes] = await Promise.all([
        productService.list(1, 1000, undefined, undefined, showDeleted),
        categoryService.list(1, 1000),
        subCategoryService.list(1, 1000),
      ])
      setProducts(prodRes.data.data)
      setTotal(prodRes.data.pagination.total)
      setCategories(catRes.data.data || [])
      setSubCategories(subCatRes.data.data || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowMobileFilters(false)
    if (!searchQuery.trim()) {
      loadData()
      return
    }
    try {
      setLoading(true)
      const response = await productService.search(searchQuery, 1, 1000, showDeleted)
      setProducts(response.data.data)
      setTotal(response.data.pagination.total)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return
    try {
      await productService.delete(id)
      loadData()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleRestore = async (id: string) => {
    if (!confirm('Restore this product?')) return
    try {
      await productService.restoreProduct(id)
      loadData()
    } catch (error) {
      console.error('Restore failed:', error)
    }
  }

  const handleSelectChange = (id: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...prev, id] : prev.filter(pid => pid !== id)
    )
  }

  const handleExport = async () => {
    try {
      const response = await productService.export()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'products.xlsx')
      document.body.appendChild(link)
      link.click()
      link.parentElement?.removeChild(link)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export products')
    }
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    try {
      const response = await productService.importPreview(file)
      setImportPreview(response.data.data)
    } catch (error) {
      console.error('Preview failed:', error)
      alert('Failed to preview import')
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    try {
      setImporting(true)
      const response = await productService.import(importFile)
      alert(`Import completed: ${response.data.data.success} success, ${response.data.data.failed} failed`)
      handleCloseImportModal()
      loadData()
    } catch (error) {
      console.error('Import failed:', error)
      alert('Failed to import products')
    } finally {
      setImporting(false)
    }
  }

  const handleCloseImportModal = () => {
    setShowImportModal(false)
    setImportFile(null)
    setImportPreview(null)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || !confirm(`Delete ${selectedIds.length} selected products?`)) return
    try {
      setDeleting(true)
      await productService.bulkDelete(selectedIds)
      setSelectedIds([])
      loadData()
    } catch (error) {
      console.error('Bulk delete failed:', error)
      alert('Failed to delete products')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Manage your product inventory
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm md:text-base"
          >
            <Download size={18} className="hidden sm:inline" />
            <span className="whitespace-nowrap">Export</span>
          </button>
          
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm md:text-base"
          >
            <Upload size={18} className="hidden sm:inline" />
            <span className="whitespace-nowrap">Import</span>
          </button>
          
          <button
            onClick={() => navigate('/products/create')}
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm md:text-base"
          >
            <Plus size={18} />
            <span className="whitespace-nowrap">New Product</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-blue-700 font-medium">
              {selectedIds.length} product{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              <Trash2 size={16} />
              {deleting ? 'Deleting...' : 'Delete Selected'}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Search and Filter Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or code..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </form>

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter size={18} />
            <span>Filter</span>
          </button>

          {/* Desktop Filter */}
          <div className="hidden md:flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show Deleted</span>
            </label>
            
            <button
              onClick={loadData}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Filter Panel */}
        {showMobileFilters && (
          <div className="mt-4 p-4 border-t border-gray-200 md:hidden">
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Show Deleted Products</span>
              </label>
              <button
                onClick={() => {
                  loadData()
                  setShowMobileFilters(false)
                }}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
              >
                <RefreshCw size={16} />
                Refresh Data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading products...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <ProductTable
                products={products}
                categories={categories}
                subCategories={subCategories}
                onEdit={(product) => navigate(`/products/${product.id}/edit`)}
                onDelete={handleDelete}
                onRestore={handleRestore}
                onView={(product) => navigate(`/products/${product.id}`)}
                selectedIds={selectedIds}
                onSelectChange={handleSelectChange}
              />
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 md:p-6 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing <span className="font-medium">{products.length}</span> of{' '}
                <span className="font-medium">{total}</span> products
              </div>
            </div>
          </>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Import Products</h2>
                  <p className="text-sm text-gray-600 mt-1">Upload Excel file to import products</p>
                </div>
                <button
                  onClick={handleCloseImportModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* File Upload Area */}
              <div className="mb-6">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportFileChange}
                    className="hidden"
                    id="import-file"
                  />
                  <label htmlFor="import-file" className="cursor-pointer block">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload size={24} className="text-blue-600" />
                    </div>
                    <p className="text-gray-900 font-medium mb-1">Choose Excel file</p>
                    <p className="text-sm text-gray-500">or drag and drop here</p>
                    <p className="text-xs text-gray-400 mt-2">Supported formats: .xlsx, .xls</p>
                  </label>
                </div>
              </div>

              {/* Preview Information */}
              {importFile && importPreview && (
                <div className="bg-gray-50 rounded-xl p-5 mb-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{importFile.name}</p>
                      <p className="text-sm text-gray-600">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setImportFile(null)
                        setImportPreview(null)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{importPreview.totalRows}</p>
                      <p className="text-xs text-gray-600">Total Rows</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{importPreview.newProducts}</p>
                      <p className="text-xs text-gray-600">New Products</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{importPreview.existingProducts}</p>
                      <p className="text-xs text-gray-600">Existing</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{importPreview.errors.length}</p>
                      <p className="text-xs text-gray-600">Errors</p>
                    </div>
                  </div>

                  {importPreview.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="font-medium text-red-700 mb-2">Import Issues</p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {importPreview.errors.slice(0, 5).map((err: any, i: number) => (
                          <p key={i} className="text-sm text-red-600">
                            • {err.message}
                          </p>
                        ))}
                        {importPreview.errors.length > 5 && (
                          <p className="text-sm text-red-600">
                            + {importPreview.errors.length - 5} more issues
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCloseImportModal}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {importing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Importing...
                    </span>
                  ) : (
                    'Start Import'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
