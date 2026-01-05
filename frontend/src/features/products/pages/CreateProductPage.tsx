import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../store/products.store'
import { ProductForm } from '../components/ProductForm'
import { useToast } from '@/contexts/ToastContext'

import type { CreateProductDto, UpdateProductDto } from '../types'

export default function CreateProductPage() {
  const navigate = useNavigate()
  const { createProduct, loading } = useProductsStore()
  const { success, error } = useToast()

  const handleSubmit = async (data: CreateProductDto | UpdateProductDto) => {
    try {
      await createProduct(data as CreateProductDto)
      success('Product created successfully')
      navigate('/products')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to create product')
    }
  }

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      navigate('/products')
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Create New Product</h1>
        <p className="text-sm text-gray-600 mt-1">Add a new product to your inventory</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <ProductForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={loading}
        />
      </div>
    </div>
  )
}
