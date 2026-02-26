import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../store/products.store'
import { ProductForm } from '../components/ProductForm'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'

import type { CreateProductDto, UpdateProductDto } from '../types'

export default function CreateProductPage() {
  const navigate = useNavigate()
  const { createProduct, mutationLoading } = useProductsStore()
  const { success, error } = useToast()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

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
    setCancelDialogOpen(true)
  }

  const confirmCancel = () => {
    navigate('/products')
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <button
          onClick={() => navigate('/products')}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center text-sm mb-2"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Product</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Add a new product to your inventory</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <ProductForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={mutationLoading}
        />
      </div>

      <ConfirmModal
        isOpen={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={confirmCancel}
        title="Cancel Creation"
        message="Are you sure you want to cancel? Any unsaved changes will be lost."
        confirmText="Yes, Cancel"
        variant="danger"
      />
    </div>
  )
}
