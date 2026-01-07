import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useProductsStore } from '../store/products.store'
import { useToast } from '@/contexts/ToastContext'
import { Package, ArrowLeft, Edit2, Trash2 } from 'lucide-react'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentProduct, fetchProductById, deleteProduct, fetchLoading, mutationLoading, error: storeError, clearError } = useProductsStore()
  const [error, setError] = useState<string | null>(null)
  const { success, error: showError } = useToast()

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError('Invalid product ID')
        return
      }

      try {
        await fetchProductById(id)
      } catch {
        setError('Product not found')
      }
    }
    fetchProduct()
  }, [id, fetchProductById])

  useEffect(() => {
    if (storeError) {
      showError(storeError)
      clearError()
    }
  }, [storeError, showError, clearError])

  const handleDelete = async () => {
    if (!id || !currentProduct) return
    
    if (confirm(`Are you sure you want to delete "${currentProduct.product_name}"?`)) {
      try {
        await deleteProduct(id)
        success('Product deleted successfully')
        navigate('/products')
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to delete product')
      }
    }
  }

  if (fetchLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-500">Loading product...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !currentProduct) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-12">
          <div className="text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/products')}
          className="text-blue-600 hover:text-blue-800 flex items-center text-sm mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Products
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{currentProduct.product_name}</h1>
            <p className="text-sm text-gray-600 mt-1">Product Code: {currentProduct.product_code}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/products/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={mutationLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
            >
              <Trash2 className="w-4 h-4" />
              {mutationLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Product Type</label>
              <p className="text-gray-900 capitalize">{currentProduct.product_type.replace('_', ' ')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                currentProduct.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                currentProduct.status === 'INACTIVE' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {currentProduct.status}
              </span>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Average Cost</label>
              <p className="text-gray-900">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  minimumFractionDigits: 0
                }).format(currentProduct.average_cost)}
              </p>
            </div>
          </div>
        </div>

        {/* Flags */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Flags</h2>
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={currentProduct.is_requestable}
                disabled
                className="rounded"
              />
              <label className="ml-2 text-gray-700">Requestable</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={currentProduct.is_purchasable}
                disabled
                className="rounded"
              />
              <label className="ml-2 text-gray-700">Purchasable</label>
            </div>
          </div>
        </div>

        {/* BOM Name */}
        {currentProduct.bom_name && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">BOM Information</h2>
            <div>
              <label className="text-sm font-medium text-gray-600">BOM Name</label>
              <p className="text-gray-900">{currentProduct.bom_name}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {currentProduct.notes && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <p className="text-gray-700">{currentProduct.notes}</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <label className="text-gray-600">Created</label>
            <p className="text-gray-900">{new Date(currentProduct.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <label className="text-gray-600">Updated</label>
            <p className="text-gray-900">{new Date(currentProduct.updated_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
