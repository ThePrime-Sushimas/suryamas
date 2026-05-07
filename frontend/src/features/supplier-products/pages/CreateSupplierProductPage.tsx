import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateSupplierProduct } from '../api/supplierProducts.api'
import { SupplierProductForm } from '../components/SupplierProductForm'
import type { CreateSupplierProductDto, UpdateSupplierProductDto } from '../types/supplier-product.types'

export function CreateSupplierProductPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createSP = useCreateSupplierProduct()

  const handleSubmit = async (data: CreateSupplierProductDto | UpdateSupplierProductDto) => {
    try {
      await createSP.mutateAsync(data as CreateSupplierProductDto)
      toast.success('Produk supplier berhasil dibuat')
      navigate('/supplier-products')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat produk supplier')) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/supplier-products')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <ShoppingBag className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Produk Supplier</h1>
            <p className="text-xs text-gray-400">Tambahkan harga produk baru dari supplier</p>
          </div>
        </div>
        <SupplierProductForm onSubmit={handleSubmit} onCancel={() => navigate('/supplier-products')} submitLabel="Buat" loading={createSP.isPending} />
      </div>
    </div>
  )
}
