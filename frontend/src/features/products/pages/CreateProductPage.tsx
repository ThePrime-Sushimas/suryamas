import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../store/products.store'
import { ProductForm } from '../components/ProductForm'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'

import { ArrowLeft } from 'lucide-react'
import { parseApiError } from '@/lib/errorParser'

import type { CreateProductDto, UpdateProductDto } from '../types'

export default function CreateProductPage() {
  const navigate = useNavigate()
  const { createProduct, mutationLoading } = useProductsStore()
  const { success, error } = useToast()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const handleSubmit = async (data: CreateProductDto | UpdateProductDto) => {
    try {
      await createProduct(data as CreateProductDto)
      success('Produk berhasil dibuat')
      navigate('/products')
    } catch (err) {
      error(parseApiError(err, 'Gagal membuat produk'))
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
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300 mb-2"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Produk Baru</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Tambahkan produk baru ke inventaris</p>
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
        title="Batalkan Pembuatan"
        message="Yakin ingin membatalkan? Perubahan yang belum disimpan akan hilang."
        confirmText="Ya, Batalkan"
        variant="danger"
      />
    </div>
  )
}
