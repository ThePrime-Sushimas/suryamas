import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { productsApi } from '../api/products.api'
import { useProductsStore } from '../store/products.store'
import { ProductForm } from '../components/ProductForm'
import type { Product, UpdateProductDto } from '../types'
import { useToast } from '@/contexts/ToastContext'

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateProduct, loading: updating } = useProductsStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { success, error: showError } = useToast()

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError('Invalid product ID')
        setLoading(false)
        return
      }

      try {
        const data = await productsApi.getById(id)
        setProduct(data)
      } catch {
        setError('Product not found')
        showError('Failed to load product')
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id, showError])

  const handleSubmit = async (data: UpdateProductDto) => {
    if (!id) return

    try {
      await updateProduct(id, data)
      success('Product updated successfully')
      navigate('/products')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update product')
    }
  }

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      navigate('/products')
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-500">Loading product...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-12">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Product not found</h3>
            <p className="mt-1 text-sm text-gray-500">{error || 'The product you are looking for does not exist.'}</p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/products')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Back to Products
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/products')}
          className="text-blue-600 hover:text-blue-800 flex items-center text-sm mb-2"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
        <p className="text-sm text-gray-600 mt-1">Update product information</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <ProductForm
          initialData={product}
          isEdit
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updating}
        />
      </div>
    </div>
  )
}
