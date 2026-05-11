import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ClipboardList, Send, CheckCircle, XCircle, Ban } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import {
  usePurchaseRequest, useSubmitPurchaseRequest, useApprovePurchaseRequest,
  useRejectPurchaseRequest, useCancelPurchaseRequest
} from '../api/purchaseRequests.api'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  APPROVED: { label: 'Disetujui', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  CONVERTED: { label: 'Dikonversi ke PO', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
}

export default function PurchaseRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const hasPermission = usePermissionStore(state => state.hasPermission)
  const canUpdate = hasPermission('purchase_requests', 'update')
  const canApprove = hasPermission('purchase_requests', 'approve')

  const { data: pr, isLoading } = usePurchaseRequest(id ?? '')
  const submitPR = useSubmitPurchaseRequest()
  const approvePR = useApprovePurchaseRequest()
  const rejectPR = useRejectPurchaseRequest()
  const cancelPR = useCancelPurchaseRequest()

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmAction, setConfirmAction] = useState<'submit' | 'approve' | 'cancel' | null>(null)

  const handleAction = async () => {
    if (!id || !confirmAction) return
    try {
      if (confirmAction === 'submit') await submitPR.mutateAsync(id)
      else if (confirmAction === 'approve') await approvePR.mutateAsync(id)
      else if (confirmAction === 'cancel') await cancelPR.mutateAsync(id)
      toast.success(confirmAction === 'submit' ? 'Berhasil diajukan' : confirmAction === 'approve' ? 'Berhasil disetujui' : 'Berhasil dibatalkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memproses')) }
    finally { setConfirmAction(null) }
  }

  const handleReject = async () => {
    if (!id || !rejectReason.trim()) { toast.error('Alasan penolakan wajib diisi'); return }
    try {
      await rejectPR.mutateAsync({ id, rejected_reason: rejectReason.trim() })
      toast.success('Purchase request ditolak')
      setShowRejectModal(false)
      setRejectReason('')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menolak')) }
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!pr) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Purchase request tidak ditemukan</p>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[pr.status] ?? STATUS_CONFIG.DRAFT

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory/purchase-requests')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ClipboardList className="w-6 h-6 text-orange-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{pr.request_number}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{pr.branch_name} — {fmtDate(pr.request_date)}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {pr.status === 'DRAFT' && canUpdate && (
              <>
                <button onClick={() => navigate(`/inventory/purchase-requests/${id}/edit`)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  Edit
                </button>
                <button onClick={() => setConfirmAction('submit')}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                  <Send className="w-4 h-4" /> Ajukan Approval
                </button>
              </>
            )}
            {pr.status === 'PENDING_APPROVAL' && canApprove && (
              <>
                <button onClick={() => setShowRejectModal(true)}
                  className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                  <XCircle className="w-4 h-4" /> Tolak
                </button>
                <button onClick={() => setConfirmAction('approve')}
                  className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                  <CheckCircle className="w-4 h-4" /> Setujui
                </button>
              </>
            )}
            {['DRAFT', 'PENDING_APPROVAL'].includes(pr.status) && canUpdate && (
              <button onClick={() => setConfirmAction('cancel')}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Ban className="w-4 h-4" /> Batalkan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Dibutuhkan</span>
            <p className="font-medium text-gray-900 dark:text-white">{pr.needed_by_date ? fmtDate(pr.needed_by_date) : '—'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Dibuat oleh</span>
            <p className="font-medium text-gray-900 dark:text-white">{pr.requested_by_name || '—'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Disetujui oleh</span>
            <p className="font-medium text-gray-900 dark:text-white">{pr.approved_by_name || '—'}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total Estimasi</span>
            <p className="font-medium text-gray-900 dark:text-white">Rp {fmt(pr.total_estimated)}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Catatan</span>
            <p className="font-medium text-gray-900 dark:text-white">{pr.notes || '—'}</p>
          </div>
        </div>
        {pr.rejected_reason && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300"><strong>Alasan Penolakan:</strong> {pr.rejected_reason}</p>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">UOM</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Est. Harga</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {(pr.lines ?? []).map((line, idx) => (
                <tr key={line.id ?? idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{line.product_name}</div>
                    <div className="text-xs text-gray-500">{line.product_code}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">{fmt(line.qty)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{line.uom}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                    {line.estimated_price ? `Rp ${fmt(line.estimated_price)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                    {line.estimated_price ? `Rp ${fmt(line.qty * line.estimated_price)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{line.supplier_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        title={confirmAction === 'submit' ? 'Ajukan Approval' : confirmAction === 'approve' ? 'Setujui PR' : 'Batalkan PR'}
        message={confirmAction === 'submit' ? 'PR akan diajukan ke Stock Keeper untuk approval. Lanjutkan?' : confirmAction === 'approve' ? 'Yakin ingin menyetujui purchase request ini?' : 'Yakin ingin membatalkan purchase request ini?'}
        confirmText={confirmAction === 'submit' ? 'Ajukan' : confirmAction === 'approve' ? 'Setujui' : 'Batalkan'}
        variant={confirmAction === 'cancel' ? 'danger' : 'success'}
        isLoading={submitPR.isPending || approvePR.isPending || cancelPR.isPending}
      />

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tolak Purchase Request</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alasan Penolakan *</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Jelaskan alasan penolakan..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Batal</button>
              <button onClick={handleReject} disabled={rejectPR.isPending || !rejectReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {rejectPR.isPending ? 'Menolak...' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
