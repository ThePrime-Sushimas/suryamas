import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useCreateProduct } from '../api/products.api'
import { ProductForm } from '../components/ProductForm'
import type { CreateProductDto, UpdateProductDto } from '../types'

export default function CreateProductPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createProduct = useCreateProduct()
  const [cancelOpen, setCancelOpen] = useState(false)

  const handleSubmit = async (data: CreateProductDto | UpdateProductDto) => {
    try {
      await createProduct.mutateAsync(data as CreateProductDto)
      toast.success('Produk berhasil dibuat')
      navigate('/products')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat produk')) }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <button onClick={() => navigate('/products')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 mb-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Produk Baru</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Tambahkan produk baru ke inventaris</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <ProductForm onSubmit={handleSubmit} onCancel={() => setCancelOpen(true)} isLoading={createProduct.isPending} />
      </div>
      <ConfirmModal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={() => navigate('/products')}
        title="Batalkan" message="Yakin ingin membatalkan? Perubahan akan hilang." confirmText="Ya, Batalkan" variant="danger" />
    </div>
  )
}
