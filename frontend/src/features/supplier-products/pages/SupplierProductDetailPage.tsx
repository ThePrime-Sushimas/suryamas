import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Pencil, Star, Trash2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useState } from 'react'
import { useSupplierProduct, useDeleteSupplierProduct } from '../api/supplierProducts.api'
import { formatPrice, formatLeadTime, formatDate } from '../utils/format'

export function SupplierProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const sp = useSupplierProduct(id || '')
  const deleteSP = useDeleteSupplierProduct()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleDelete = async () => {
    if (!id) return
    try {
      await deleteSP.mutateAsync(id)
      toast.success('Produk supplier berhasil dihapus')
      navigate('/supplier-products')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus')) }
    finally { setDeleteOpen(false) }
  }

  if (sp.isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="space-y-4">
          <div className="flex items-center gap-3"><div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"><FormSkeleton /></div>
        </div>
      </div>
    )
  }

  if (!sp.data) {
    return (
      <div className="max-w-3xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Produk supplier tidak ditemukan</h3>
          <button onClick={() => navigate('/supplier-products')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  const d = sp.data

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/supplier-products')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <ShoppingBag className="w-6 h-6 text-blue-600" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{d.product?.product_name}</h1>
          <p className="text-xs text-gray-400">{d.supplier?.supplier_name} • {d.supplier?.supplier_code}</p>
        </div>
        <button onClick={() => navigate(`/supplier-products/${id}/edit`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Harga</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatPrice(d.current_price || d.price, d.current_currency || d.currency)}</p>
          {d.current_price && <p className="text-[10px] text-gray-400">From pricelist</p>}
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Lead Time</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatLeadTime(d.lead_time_days)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Preferred</p>
          <p className="text-lg font-bold">{d.is_preferred ? <Star className="w-5 h-5 text-amber-500 fill-amber-500 inline" /> : <span className="text-gray-400">—</span>}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Status</p>
          <p className={`text-lg font-bold ${d.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>{d.is_active ? 'Aktif' : 'Nonaktif'}</p>
        </div>
      </div>

      {/* Detail Sections */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi Supplier</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-400">Nama</p><p className="text-sm font-medium text-gray-900 dark:text-white">{d.supplier?.supplier_name || '—'}</p></div>
            <div><p className="text-xs text-gray-400">Kode</p><p className="text-sm font-medium text-gray-900 dark:text-white">{d.supplier?.supplier_code || '—'}</p></div>
          </div>
        </div>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi Produk</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-400">Nama</p><p className="text-sm font-medium text-gray-900 dark:text-white">{d.product?.product_name || '—'}</p></div>
            <div><p className="text-xs text-gray-400">Kode</p><p className="text-sm font-medium text-gray-900 dark:text-white">{d.product?.product_code || '—'}</p></div>
            <div><p className="text-xs text-gray-400">Tipe</p><p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{d.product?.product_type?.replace('_', ' ') || '—'}</p></div>
            <div><p className="text-xs text-gray-400">Min. Order</p><p className="text-sm font-medium text-gray-900 dark:text-white">{d.min_order_qty ? d.min_order_qty.toLocaleString('id-ID') : 'Tidak ada minimum'}</p></div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <div className="flex gap-4 text-xs text-gray-400">
            <span>Dibuat: {formatDate(d.created_at)}</span>
            <span>Diperbarui: {formatDate(d.updated_at)}</span>
          </div>
          <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg">
            <Trash2 className="w-3.5 h-3.5" /> Hapus
          </button>
        </div>
      </div>

      <ConfirmModal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
        title="Hapus Produk Supplier" message={`Yakin ingin menghapus "${d.product?.product_name}" dari "${d.supplier?.supplier_name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteSP.isPending} />
    </div>
  )
}
