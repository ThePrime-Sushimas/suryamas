import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Star } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { useSupplierProduct, useUpdateSupplierProduct } from '../api/supplierProducts.api'
import { SupplierProductForm } from '../components/SupplierProductForm'
import { formatPrice } from '../utils/format'
import type { UpdateSupplierProductDto } from '../types/supplier-product.types'

export function EditSupplierProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const sp = useSupplierProduct(id || '')
  const updateSP = useUpdateSupplierProduct()

  const handleSubmit = async (data: UpdateSupplierProductDto) => {
    if (!id) return
    try {
      await updateSP.mutateAsync({ id, ...data })
      toast.success('Produk supplier berhasil diperbarui')
      navigate('/supplier-products')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal mengupdate produk supplier')) }
  }

  if (sp.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center gap-3"><div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3"><div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" /><div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
          ))}</div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"><FormSkeleton /></div>
        </div>
      </div>
    )
  }

  if (!sp.data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Produk supplier tidak ditemukan</h3>
          <button onClick={() => navigate('/supplier-products')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  const d = sp.data

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/supplier-products')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <ShoppingBag className="w-6 h-6 text-blue-600" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Produk Supplier</h1>
            <p className="text-xs text-gray-400">{d.supplier?.supplier_name} → {d.product?.product_name}</p>
          </div>
          <button onClick={() => navigate(`/supplier-products/${id}/pricelists`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            Kelola Harga
          </button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Harga</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(d.current_price || d.price, d.current_currency || d.currency)}</p>
            {d.current_price && <p className="text-[10px] text-gray-400">From pricelist</p>}
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Lead Time</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{d.lead_time_days ? `${d.lead_time_days} hari` : '—'}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Preferred</p>
            <p className="text-sm font-bold">{d.is_preferred ? <Star className="w-4 h-4 text-amber-500 fill-amber-500 inline" /> : <span className="text-gray-400">Tidak</span>}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <p className="text-xs text-gray-400">Status</p>
            <p className={`text-sm font-bold ${d.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>{d.is_active ? 'Aktif' : 'Nonaktif'}</p>
          </div>
        </div>

        {/* Form */}
        <SupplierProductForm initialData={d} onSubmit={handleSubmit} onCancel={() => navigate('/supplier-products')} submitLabel="Simpan Perubahan" isEdit loading={updateSP.isPending} />
      </div>
    </div>
  )
}
