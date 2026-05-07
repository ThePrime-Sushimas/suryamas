import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Package } from 'lucide-react'
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
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/products')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <Package className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Produk Baru</h1>
          <p className="text-xs text-gray-400">Tambahkan produk baru ke inventaris</p>
        </div>
      </div>

      {/* Form */}
      <ProductForm onSubmit={handleSubmit} onCancel={() => setCancelOpen(true)} isLoading={createProduct.isPending} />

      <ConfirmModal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={() => navigate('/products')}
        title="Batalkan" message="Yakin ingin membatalkan? Data yang diisi akan hilang." confirmText="Ya, Batalkan" variant="danger" />
    </div>
  )
}
