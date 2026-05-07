import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { useProduct, useUpdateProduct } from '../api/products.api'
import { ProductForm } from '../components/ProductForm'
import type { UpdateProductDto } from '../types'

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const product = useProduct(id || '')
  const updateProduct = useUpdateProduct()
  const [cancelOpen, setCancelOpen] = useState(false)

  const handleSubmit = async (data: UpdateProductDto) => {
    if (!id) return
    try {
      await updateProduct.mutateAsync({ id, ...data })
      toast.success('Produk berhasil diperbarui')
      navigate('/products')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal mengupdate produk')) }
  }

  if (product.isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="mb-6">
          <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <FormSkeleton />
        </div>
      </div>
    )
  }

  if (!product.data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Produk tidak ditemukan</h3>
          <button onClick={() => navigate('/products')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <button onClick={() => navigate('/products')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 mb-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Produk</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{product.data.product_code} — {product.data.product_name}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <ProductForm initialData={product.data} isEdit onSubmit={handleSubmit} onCancel={() => setCancelOpen(true)} isLoading={updateProduct.isPending} />
      </div>
      <ConfirmModal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={() => navigate('/products')}
        title="Batalkan" message="Yakin ingin membatalkan? Perubahan akan hilang." confirmText="Ya, Batalkan" variant="danger" />
    </div>
  )
}
