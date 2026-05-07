import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, Ruler } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { useProduct, useUpdateProduct } from '../api/products.api'
import { ProductForm } from '../components/ProductForm'
import type { UpdateProductDto, ProductType } from '../types'

const fmt = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
const TYPE_LABELS: Record<ProductType, string> = { raw: 'Bahan Baku', semi_finished: 'Setengah Jadi', finished_goods: 'Barang Jadi' }

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
      <div className="max-w-3xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"><FormSkeleton /></div>
      </div>
    )
  }

  if (!product.data) {
    return (
      <div className="max-w-3xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Produk tidak ditemukan</h3>
          <button onClick={() => navigate('/products')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  const p = product.data

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/products')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{p.product_name}</h1>
          <p className="text-xs text-gray-400">{p.product_code} • {TYPE_LABELS[p.product_type]}</p>
        </div>
        <button onClick={() => navigate(`/products/${id}/uoms`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <Ruler className="w-3.5 h-3.5" /> Kelola UOM
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Avg Cost</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {p.average_cost > 0 ? `Rp ${fmt(p.average_cost)}` : '—'}
          </p>
          {p.base_unit_name && <p className="text-[10px] text-gray-400">per {p.base_unit_name}</p>}
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Tipe</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{TYPE_LABELS[p.product_type]}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Status</p>
          <p className={`text-lg font-bold ${p.status === 'ACTIVE' ? 'text-emerald-600' : p.status === 'INACTIVE' ? 'text-gray-500' : 'text-red-500'}`}>
            {p.status === 'ACTIVE' ? 'Aktif' : p.status === 'INACTIVE' ? 'Nonaktif' : 'Dihentikan'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Flags</p>
          <div className="flex gap-1 mt-1">
            {p.is_requestable && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">REQ</span>}
            {p.is_purchasable && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">PUR</span>}
            {!p.is_requestable && !p.is_purchasable && <span className="text-sm text-gray-400">—</span>}
          </div>
        </div>
      </div>

      {/* Form */}
      <ProductForm initialData={p} isEdit onSubmit={handleSubmit} onCancel={() => setCancelOpen(true)} isLoading={updateProduct.isPending} />

      <ConfirmModal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={() => navigate('/products')}
        title="Batalkan" message="Yakin ingin membatalkan? Perubahan akan hilang." confirmText="Ya, Batalkan" variant="danger" />
    </div>
  )
}
