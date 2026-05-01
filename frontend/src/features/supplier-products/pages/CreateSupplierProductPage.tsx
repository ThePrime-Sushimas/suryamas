// Create Supplier Product Page

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft } from 'lucide-react'
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
      toast.success('Produk supplier berhasil dibuat')
      navigate('/supplier-products')
    } catch {
      // Error already handled in store and shown via useEffect
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
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm font-medium mb-4 flex items-center"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Produk Supplier</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tambahkan harga produk baru dari supplier</p>
        </div>

        {/* Form */}
        <SupplierProductForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel="Buat"
          loading={mutationLoading}
        />
      </div>
    </div>
  )
}

