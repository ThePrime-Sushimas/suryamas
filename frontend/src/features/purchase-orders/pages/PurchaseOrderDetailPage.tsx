import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Send, CheckCircle, Truck, XCircle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  usePurchaseOrder, useSubmitPurchaseOrder, useApprovePurchaseOrder,
  useMarkSentPurchaseOrder, useCancelPurchaseOrder
} from '../api/purchaseOrders.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-green-100 text-green-700' },
  SENT: { label: 'Dikirim ke Supplier', color: 'bg-blue-100 text-blue-700' },
  PARTIAL_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-indigo-100 text-indigo-700' },
  FULLY_RECEIVED: { label: 'Diterima Semua', color: 'bg-emerald-100 text-emerald-700' },
  CLOSED: { label: 'Selesai', color: 'bg-purple-100 text-purple-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-600' },
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canUpdate = hasPermission('purchase_orders', 'update')
  const canApprove = hasPermission('purchase_orders', 'approve')

  const { data: po, isLoading } = usePurchaseOrder(id ?? '')
  const submitPO = useSubmitPurchaseOrder()
  const approvePO = useApprovePurchaseOrder()
  const markSent = useMarkSentPurchaseOrder()
  const cancelPO = useCancelPurchaseOrder()

  const [confirmAction, setConfirmAction] = useState<'submit' | 'approve' | 'send' | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const handleAction = async () => {
    if (!id || !confirmAction) return
    try {
      if (confirmAction === 'submit') await submitPO.mutateAsync(id)
      else if (confirmAction === 'approve') await approvePO.mutateAsync(id)
      else if (confirmAction === 'send') await markSent.mutateAsync(id)
      toast.success(confirmAction === 'submit' ? 'PO diajukan' : confirmAction === 'approve' ? 'PO disetujui' : 'PO ditandai terkirim')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memproses')) }
    finally { setConfirmAction(null) }
  }

  const handleCancel = async () => {
    if (!id || !cancelReason.trim()) { toast.error('Alasan pembatalan wajib diisi'); return }
    try {
      await cancelPO.mutateAsync({ id, cancelled_reason: cancelReason.trim() })
      toast.success('PO dibatalkan')
      setShowCancelModal(false)
      setCancelReason('')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membatalkan')) }
  }

  if (isLoading) {
    return <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6"><div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}</div></div>
  }

  if (!po) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><p className="text-gray-500">Purchase order tidak ditemukan</p></div>
  }

  const statusCfg = STATUS_CONFIG[po.status] ?? STATUS_CONFIG.DRAFT

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory/purchase-orders')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{po.po_number}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{po.supplier_name} — {po.branch_name}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
          </div>

          <div className="flex gap-2">
            {po.status === 'DRAFT' && canUpdate && (
              <button onClick={() => navigate(`/inventory/purchase-orders/${id}/edit`)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                Edit
              </button>
            )}
            {po.status === 'DRAFT' && canUpdate && (
              <button onClick={() => setConfirmAction('submit')} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Send className="w-4 h-4" /> Ajukan Approval
              </button>
            )}
            {po.status === 'PENDING_APPROVAL' && canApprove && (
              <button onClick={() => setConfirmAction('approve')} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                <CheckCircle className="w-4 h-4" /> Setujui
              </button>
            )}
            {po.status === 'APPROVED' && canUpdate && (
              <button onClick={() => setConfirmAction('send')} className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                <Truck className="w-4 h-4" /> Tandai Terkirim
              </button>
            )}
            {['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'].includes(po.status) && canUpdate && (
              <button onClick={() => setShowCancelModal(true)} className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20">
                <XCircle className="w-4 h-4" /> Batalkan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Tanggal Order</span>
            <p className="font-medium text-gray-900 dark:text-white">{fmtDate(po.order_date)}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Estimasi Kirim</span>
            <p className="font-medium text-gray-900 dark:text-white">{po.expected_delivery_date ? fmtDate(po.expected_delivery_date) : '—'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Pembayaran</span>
            <p className="font-medium text-gray-900 dark:text-white">{po.payment_type === 'CASH' ? 'Cash' : `Tempo ${po.payment_terms_days ?? ''}hr`}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Dari PR</span>
            <p className="font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={() => navigate(`/inventory/purchase-requests/${po.purchase_request_id}`)}>{po.request_number}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total</span>
            <p className="font-bold text-gray-900 dark:text-white">Rp {fmt(po.total_amount)}</p>
          </div>
        </div>
        {po.cancelled_reason && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300"><strong>Alasan Pembatalan:</strong> {po.cancelled_reason}</p>
          </div>
        )}
      </div>

      {/* Lines Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Diterima</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">UOM</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga/Unit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {(po.lines ?? []).map((line, idx) => (
                <tr key={line.id ?? idx}>
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{line.product_name}</div>
                    <div className="text-xs text-gray-500">{line.product_code}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">{fmt(line.qty)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={line.qty_received && line.qty_received >= line.qty ? 'text-green-600' : 'text-gray-500'}>
                      {fmt(line.qty_received ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{line.uom}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">Rp {fmt(line.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">Rp {fmt(line.total_price ?? line.qty * line.unit_price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">Total:</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">Rp {fmt(po.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} onConfirm={handleAction}
        title={confirmAction === 'submit' ? 'Ajukan PO' : confirmAction === 'approve' ? 'Setujui PO' : 'Tandai Terkirim'}
        message={confirmAction === 'submit' ? 'PO akan diajukan untuk approval. Lanjutkan?' : confirmAction === 'approve' ? 'Yakin ingin menyetujui PO ini?' : 'Tandai PO sudah dikirim ke supplier?'}
        confirmText={confirmAction === 'submit' ? 'Ajukan' : confirmAction === 'approve' ? 'Setujui' : 'Tandai Terkirim'}
        variant="success" isLoading={submitPO.isPending || approvePO.isPending || markSent.isPending} />

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Batalkan Purchase Order</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alasan Pembatalan *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder="Jelaskan alasan pembatalan..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Batal</button>
              <button onClick={handleCancel} disabled={cancelPO.isPending || !cancelReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {cancelPO.isPending ? 'Membatalkan...' : 'Batalkan PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
