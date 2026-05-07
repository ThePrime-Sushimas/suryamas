import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, DollarSign, Pencil } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePricelist, useDeletePricelist, useApprovePricelist, useRestorePricelist } from '../api/pricelists.api'
import { formatPrice, formatDate, formatStatus, getValidityStatus, getValidityColorClass } from '../utils/format'
import { isEditable, isApprovable, getStatusColorClass } from '../constants/pricelist.constants'

export function PricelistDetailPage() {
  const { id, supplierProductId, pricelistId } = useParams<{ id?: string; supplierProductId?: string; pricelistId?: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const actualId = pricelistId || id || ''
  const backPath = supplierProductId ? `/supplier-products/${supplierProductId}/pricelists` : '/pricelists'

  const pricelist = usePricelist(actualId)
  const deletePL = useDeletePricelist()
  const approvePL = useApprovePricelist()
  const restorePL = useRestorePricelist()

  const [modal, setModal] = useState<'delete' | 'approve' | 'reject' | 'restore' | null>(null)

  const handleAction = async () => {
    if (!actualId || !modal) return
    try {
      if (modal === 'delete') { await deletePL.mutateAsync(actualId); toast.success('Pricelist berhasil dihapus'); navigate(backPath) }
      else if (modal === 'approve') { await approvePL.mutateAsync({ id: actualId, status: 'APPROVED' }); toast.success('Pricelist berhasil diapprove') }
      else if (modal === 'reject') { await approvePL.mutateAsync({ id: actualId, status: 'REJECTED' }); toast.success('Pricelist ditolak') }
      else if (modal === 'restore') { await restorePL.mutateAsync(actualId); toast.success('Pricelist berhasil dipulihkan') }
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memproses')) }
    finally { setModal(null) }
  }

  if (pricelist.isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="space-y-4">
          <div className="flex items-center gap-3"><div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"><FormSkeleton /></div>
        </div>
      </div>
    )
  }

  if (!pricelist.data) {
    return (
      <div className="max-w-3xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <DollarSign className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Pricelist tidak ditemukan</h3>
          <button onClick={() => navigate(backPath)} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  const p = pricelist.data
  const validityStatus = getValidityStatus(p.valid_from, p.valid_to)
  const canEdit = isEditable(p.status)
  const canApprove = isApprovable(p.status)
  const canRestore = !!p.deleted_at
  const isMutating = deletePL.isPending || approvePL.isPending || restorePL.isPending

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(backPath)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <DollarSign className="w-6 h-6 text-green-600" />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{p.supplier_name || p.supplier?.supplier_name}</h1>
          <p className="text-xs text-gray-400">{p.product_name || p.product?.product_name} • {p.uom_name || p.uom?.uom_name}</p>
        </div>
        {canEdit && (
          <button onClick={() => supplierProductId ? navigate(`/supplier-products/${supplierProductId}/pricelists/${actualId}/edit`) : navigate(`/pricelists/${actualId}/edit`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Harga</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatPrice(p.price, p.currency)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Status</p>
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColorClass(p.status)}`}>{formatStatus(p.status)}</span>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Validitas</p>
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getValidityColorClass(validityStatus.color)}`}>{validityStatus.label}</span>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Aktif</p>
          <p className={`text-sm font-bold ${p.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>{p.is_active ? 'Ya' : 'Tidak'}</p>
        </div>
      </div>

      {/* Detail */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-400">Supplier</p><p className="text-sm font-medium text-gray-900 dark:text-white">{p.supplier_name || p.supplier?.supplier_name || '—'}</p></div>
            <div><p className="text-xs text-gray-400">Produk</p><p className="text-sm font-medium text-gray-900 dark:text-white">{p.product_name || p.product?.product_name || '—'}</p></div>
            <div><p className="text-xs text-gray-400">UOM</p><p className="text-sm font-medium text-gray-900 dark:text-white">{p.uom_name || p.uom?.uom_name || '—'}</p></div>
            <div><p className="text-xs text-gray-400">Mata Uang</p><p className="text-sm font-medium text-gray-900 dark:text-white">{p.currency}</p></div>
          </div>
        </div>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Periode Berlaku</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-400">Berlaku Dari</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(p.valid_from)}</p></div>
            <div><p className="text-xs text-gray-400">Berlaku Sampai</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(p.valid_to) || 'Tidak ada batas'}</p></div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <div className="flex gap-4 text-xs text-gray-400">
            <span>Dibuat: {formatDate(p.created_at)}</span>
            <span>Diperbarui: {formatDate(p.updated_at)}</span>
          </div>
          <div className="flex gap-2">
            {canApprove && (
              <>
                <button onClick={() => setModal('approve')} disabled={isMutating} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">Approve</button>
                <button onClick={() => setModal('reject')} disabled={isMutating} className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">Reject</button>
              </>
            )}
            {canRestore ? (
              <button onClick={() => setModal('restore')} disabled={isMutating} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Pulihkan</button>
            ) : (
              <button onClick={() => setModal('delete')} disabled={isMutating} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50">Hapus</button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal isOpen={!!modal} onClose={() => setModal(null)} onConfirm={handleAction}
        title={modal === 'delete' ? 'Hapus Pricelist' : modal === 'approve' ? 'Approve Pricelist' : modal === 'reject' ? 'Reject Pricelist' : 'Pulihkan Pricelist'}
        message={modal === 'delete' ? 'Yakin ingin menghapus pricelist ini?' : modal === 'approve' ? 'Yakin ingin approve pricelist ini?' : modal === 'reject' ? 'Yakin ingin reject pricelist ini?' : 'Yakin ingin memulihkan pricelist ini?'}
        confirmText={modal === 'delete' ? 'Hapus' : modal === 'approve' ? 'Approve' : modal === 'reject' ? 'Reject' : 'Pulihkan'}
        variant={modal === 'delete' ? 'danger' : modal === 'reject' ? 'warning' : 'success'}
        isLoading={isMutating} />
    </div>
  )
}
