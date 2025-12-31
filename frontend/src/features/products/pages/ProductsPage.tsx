import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../store/products.store'
import { ProductTable } from '../components/ProductTable'

export default function ProductsPage() {
  const navigate = useNavigate()
  const { products, loading, fetchProducts, searchProducts, deleteProduct } = useProductsStore()
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (search) {
      searchProducts(search, 1, 1000)
    } else {
      fetchProducts(1, 1000)
    }
  }, [search])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this product?')) {
      try {
        await deleteProduct(id)
      } catch {
        console.error('Delete failed')
      }
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <button onClick={() => navigate('/products/create')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Add Product
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <ProductTable
          products={products}
          onView={id => navigate(`/products/${id}`)}
          onEdit={id => navigate(`/products/${id}/edit`)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
