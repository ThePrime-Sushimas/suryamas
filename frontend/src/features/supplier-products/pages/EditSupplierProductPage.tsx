// Edit Supplier Product Page

import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useSupplierProductsStore } from '../store/supplierProducts.store'
import { supplierProductsApi } from '../api/supplierProducts.api'
import { SupplierProductForm } from '../components/SupplierProductForm'
import type { UpdateSupplierProductDto, SupplierProduct } from '../types/supplier-product.types'

export function EditSupplierProductPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const includeDeleted = searchParams.get('deleted') === 'true'
  const { updateSupplierProduct, mutationLoading, error, clearError } = useSupplierProductsStore()

  const [supplierProduct, setSupplierProduct] = useState<SupplierProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load supplier product data
  useEffect(() => {
    const controller = new AbortController()

    const loadData = async () => {
      if (!id) {
        setLoadError('Invalid supplier product ID')
        setLoading(false)
        return
      }

      try {
        const data = await supplierProductsApi.getById(id, true, includeDeleted, controller.signal)
        setSupplierProduct(data)
      } catch (err) {
        if (err instanceof Error && err.name === 'CanceledError') return
        setLoadError('Failed to load supplier product')
      } finally {
        setLoading(false)
      }
    }

    loadData()
    return () => controller.abort()
  }, [id, includeDeleted])

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, toast, clearError])

  const handleSubmit = async (data: UpdateSupplierProductDto) => {
    if (!id) return

    try {
      await updateSupplierProduct(id, data)
      toast.success('Supplier product updated successfully')
      navigate('/supplier-products')
    } catch {
      // Error handled in store
    }
  }

  const handleCancel = () => {
    navigate('/supplier-products')
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadError || !supplierProduct) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <button
            onClick={() => navigate('/supplier-products')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 flex items-center justify-center"
          >
            ← Back to Supplier Products
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-red-800 mb-2">Error Loading Data</h2>
            <p className="text-red-600">{loadError || 'Supplier product not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/supplier-products')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 flex items-center"
          >
            ← Back to Supplier Products
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Supplier Product</h1>
          <p className="text-gray-500 mt-1">Update supplier product pricing and details</p>
        </div>

        {/* Form */}
        <SupplierProductForm
          initialData={supplierProduct}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel="Save Changes"
          isEdit
          loading={mutationLoading}
        />
      </div>
    </div>
  )
}

