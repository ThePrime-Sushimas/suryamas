import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { productService } from '../../services/productService'
import { categoryService, subCategoryService } from '../../services/categoryService'
import { ProductTable } from '../../components/products/ProductTable'
import type { Product } from '../../types/product'
import { Plus, Search, Download, Upload, X } from 'lucide-react'

export const ProductsPage = () => {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showDeleted, setShowDeleted] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    loadData()
  }, [page, limit, showDeleted])

  const loadData = async () => {
    try {
      setLoading(true)
      const [prodRes, catRes, subCatRes] = await Promise.all([
        productService.list(page, limit, undefined, undefined, showDeleted),
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
    if (!searchQuery.trim()) {
      loadData()
      return
    }
    try {
      setLoading(true)
      const response = await productService.search(searchQuery, 1, limit, showDeleted)
      setProducts(response.data.data)
      setTotal(response.data.pagination.total)
      setPage(1)
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

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Products</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700"
          >
            <Download size={20} /> Export
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-purple-700"
          >
            <Upload size={20} /> Import
          </button>
          <button
            onClick={() => navigate('/products/create')}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={20} /> New Product
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or code..."
          className="flex-1 px-4 py-2 border rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
        >
          <Search size={20} /> Search
        </button>
        <label className="flex items-center gap-2 px-4 py-2 border rounded">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Show Deleted</span>
        </label>
      </form>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <>
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

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {products.length} of {total} products
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Import Products</h2>
              <button onClick={handleCloseImportModal} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFileChange}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file" className="cursor-pointer">
                <Upload size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">Click to select Excel file</p>
              </label>
            </div>

            {importFile && (
              <div className="bg-gray-50 p-4 rounded space-y-2">
                <p className="text-sm font-medium">File: {importFile.name}</p>
                {importPreview && (
                  <>
                    <p className="text-sm">Total rows: {importPreview.totalRows}</p>
                    <p className="text-sm">New products: {importPreview.newProducts}</p>
                    <p className="text-sm">Existing products: {importPreview.existingProducts}</p>
                    {importPreview.errors.length > 0 && (
                      <div className="text-sm text-red-600">
                        <p>Errors: {importPreview.errors.length}</p>
                        {importPreview.errors.slice(0, 3).map((err: any, i: number) => (
                          <p key={i} className="text-xs">{err.message}</p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCloseImportModal}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
