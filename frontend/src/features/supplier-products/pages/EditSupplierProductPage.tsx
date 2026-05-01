// Edit Supplier Product Page

import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft } from 'lucide-react'
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
      toast.success('Produk supplier berhasil diperbarui')
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
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-8"></div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm font-medium mb-4 flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Gagal Memuat Data</h2>
            <p className="text-red-600 dark:text-red-400">{loadError || 'Produk supplier tidak ditemukan'}</p>
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
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm font-medium mb-4 flex items-center"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Produk Supplier</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Perbarui harga dan detail produk supplier</p>
        </div>

        {/* Form */}
        <SupplierProductForm
          initialData={supplierProduct}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel="Simpan Perubahan"
          isEdit
          loading={mutationLoading}
        />
      </div>
    </div>
  )
}

