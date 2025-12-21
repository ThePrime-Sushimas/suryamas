import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { productService } from '../../services/productService'
import { categoryService, subCategoryService } from '../../services/categoryService'
import { ProductTable } from '../../components/products/ProductTable'
import type { Product } from '../../types/product'
import { Plus, Search } from 'lucide-react'

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

  const handleSelectChange = (id: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...prev, id] : prev.filter(pid => pid !== id)
    )
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Products</h1>
        <button
          onClick={() => navigate('/products/create')}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={20} /> New Product
        </button>
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
    </div>
  )
}
