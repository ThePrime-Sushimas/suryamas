import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { productService } from '../../services/productService'
import { categoryService, subCategoryService } from '../../services/categoryService'
import { ProductForm } from '../../components/products/ProductForm'
import type { Product, UpdateProductDto } from '../../types/product'
import { ArrowLeft } from 'lucide-react'

export const EditProductPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [prodRes, catRes, subCatRes] = await Promise.allSettled([
        productService.getById(id!, true), // Include deleted to handle restoration
        categoryService.list(1, 1000),
        subCategoryService.list(1, 1000),
      ])
      
      if (prodRes.status === 'fulfilled') {
        setProduct(prodRes.value.data.data)
      } else {
        console.error('Failed to load product:', prodRes.reason)
        if (prodRes.reason?.response?.status === 404) {
          alert('Product not found')
          navigate('/products')
          return
        }
      }
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data.data || [])
      if (subCatRes.status === 'fulfilled') setSubCategories(subCatRes.value.data.data || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: UpdateProductDto) => {
    try {
      setLoading(true)
      await productService.update(id!, data)
      navigate(`/products/${id}`)
    } catch (error) {
      console.error('Update failed:', error)
      alert('Failed to update product')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!product) return <div className="p-6">Product not found</div>

  const handleRestoreProduct = async () => {
    if (!confirm('Restore this product?')) return
    try {
      setLoading(true)
      await productService.restoreProduct(id!)
      await loadData()
    } catch (error) {
      console.error('Restore failed:', error)
      alert('Failed to restore product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/products/${id}`)}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold">Edit Product</h1>
        {product.is_deleted && (
          <button
            onClick={handleRestoreProduct}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ml-auto"
          >
            Restore Product
          </button>
        )}
      </div>
      
      {product.is_deleted && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
          <p className="text-yellow-800">
            This product has been deleted. Please restore it before editing.
          </p>
        </div>
      )}
      
      <div className="bg-white p-6 rounded shadow">
        <ProductForm
          product={product}
          categories={categories}
          subCategories={subCategories}
          onSubmit={handleSubmit}
          isLoading={loading}
        />
      </div>
    </div>
  )
}
