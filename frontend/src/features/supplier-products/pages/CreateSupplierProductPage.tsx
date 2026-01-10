// Create Supplier Product Page

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useSupplierProductsStore } from '../store/supplierProducts.store'
import { SupplierProductForm } from '../components/SupplierProductForm'
import type { CreateSupplierProductDto, UpdateSupplierProductDto } from '../types/supplier-product.types'

export function CreateSupplierProductPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { createSupplierProduct, mutationLoading, error, clearError } = useSupplierProductsStore()

  // Show error toast
  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, toast, clearError])

  const handleSubmit = async (data: CreateSupplierProductDto | UpdateSupplierProductDto) => {
    try {
      await createSupplierProduct(data as CreateSupplierProductDto)
      toast.success('Supplier product created successfully')
      navigate('/supplier-products')
    } catch (err) {
      const errorMsg = err instanceof Error 
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message || err.message 
        : 'Failed to create supplier product'
      toast.error(errorMsg)
    }
  }

  const handleCancel = () => {
    navigate('/supplier-products')
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
          <h1 className="text-2xl font-bold text-gray-900">Create Supplier Product</h1>
          <p className="text-gray-500 mt-1">Add a new product price from a supplier</p>
        </div>

        {/* Form */}
        <SupplierProductForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel="Create"
          loading={mutationLoading}
        />
      </div>
    </div>
  )
}

