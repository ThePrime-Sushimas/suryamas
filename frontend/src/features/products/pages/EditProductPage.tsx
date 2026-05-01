import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useProductsStore } from '../store/products.store'
import { ProductForm } from '../components/ProductForm'
import type { UpdateProductDto } from '../types'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { ArrowLeft } from 'lucide-react'
import { parseApiError } from '@/lib/errorParser'

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentProduct, fetchProductById, updateProduct, fetchLoading, mutationLoading, error: storeError, clearError } = useProductsStore()
  const [error, setError] = useState<string | null>(null)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const { success, error: showError } = useToast()

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) {
        setError('ID produk tidak valid')
        return
      }

      try {
        await fetchProductById(id)
      } catch {
        setError('Produk tidak ditemukan')
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

  const handleSubmit = async (data: UpdateProductDto) => {
    if (!id) return

    try {
      await updateProduct(id, data)
      success('Produk berhasil diperbarui')
      navigate('/products')
    } catch (err) {
      showError(parseApiError(err, 'Gagal mengupdate produk'))
    }
  }

  const handleCancel = () => {
    setCancelDialogOpen(true)
  }

  const confirmCancel = () => {
    navigate('/products')
  }

  if (fetchLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <CardSkeleton />
            <p className="text-gray-500 dark:text-gray-400">Loading product...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !currentProduct) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12">
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
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Produk tidak ditemukan</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error || 'Produk yang Anda cari tidak ada.'}</p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/products')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Kembali ke Produk
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <button
          onClick={() => navigate('/products')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300 mb-2"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Produk</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Perbarui informasi produk</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <ProductForm
          initialData={currentProduct}
          isEdit
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={mutationLoading}
        />
      </div>

      <ConfirmModal
        isOpen={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        onConfirm={confirmCancel}
        title="Batalkan Pengeditan"
        message="Yakin ingin membatalkan? Perubahan yang belum disimpan akan hilang."
        confirmText="Ya, Batalkan"
        variant="danger"
      />
    </div>
  )
}
