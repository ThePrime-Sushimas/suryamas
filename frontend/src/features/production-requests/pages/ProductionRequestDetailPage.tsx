import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Package, X, Printer } from 'lucide-react'
import { useListNavigation } from '@/lib/urlFilters'
import {
  useProductionRequest, useAcceptProductionRequest,
  useReceiveProductionRequest, useCancelProductionRequest,
  usePrintProductionRequest,
} from '../api/productionRequests.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { usePermission } from '@/features/branch_context/hooks/usePermission'
import { usePrinters } from '@/features/printers/api'
import { useState } from 'react'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ACCEPTED: 'Diproses',
  RECEIVED: 'Diterima',
  CANCELLED: 'Dibatalkan',
}

export default function ProductionRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { backToList } = useListNavigation('/food-production/production-requests')
  const navigate = useNavigate()
  const { data: request, isLoading } = useProductionRequest(id ?? '')
  const acceptMutation = useAcceptProductionRequest()
  const receiveMutation = useReceiveProductionRequest()
  const cancelMutation = useCancelProductionRequest()
  const printMutation = usePrintProductionRequest()

  const { hasPermission: canApprove } = usePermission('production_requests', 'approve')
  const { data: printers = [] } = usePrinters()

  const [acceptNotes, setAcceptNotes] = useState('')
  const [receiveNotes, setReceiveNotes] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showAcceptDialog, setShowAcceptDialog] = useState(false)
  const [lineApprovals, setLineApprovals] = useState<Record<string, number>>({})
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const toast = useToast()

  if (isLoading) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Loading...</div>
  }

  if (!request) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Request tidak ditemukan</div>
  }

  const handleAccept = async () => {
    try {
      const linesPayload = request.lines?.map(l => ({
        id: l.id,
        qty_approved: lineApprovals[l.id] ?? l.qty,
      }))
      await acceptMutation.mutateAsync({
        id: request.id,
        accept_notes: acceptNotes || null,
        lines: linesPayload,
      })
      setShowAcceptDialog(false)
      toast.success('Request berhasil diterima & diproses')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal menerima request'))
    }
  }

  const handleReceive = async () => {
    try {
      await receiveMutation.mutateAsync({
        id: request.id,
        receive_notes: receiveNotes || null,
      })
      toast.success('Penerimaan berhasil dikonfirmasi')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal konfirmasi penerimaan'))
    }
  }

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({ id: request.id, cancel_reason: cancelReason })
      setShowCancelDialog(false)
      toast.success('Request dibatalkan')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membatalkan request'))
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={backToList} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">{request.request_number}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[request.status]}`}>
                  {STATUS_LABEL[request.status]}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Dibuat oleh {request.created_by_name ?? '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* DRAFT actions */}
            {request.status === 'DRAFT' && (
              <>
                <button
                  onClick={() => navigate(`/food-production/production-requests/${request.id}/edit`)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Edit
                </button>
                {canApprove && (
                  <button
                    onClick={() => setShowAcceptDialog(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    <Check className="w-4 h-4" /> Terima & Proses
                  </button>
                )}
              </>
            )}
            {/* Receive — visible when ACCEPTED */}
            {request.status === 'ACCEPTED' && (
              <button
                onClick={handleReceive}
                disabled={receiveMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {receiveMutation.isPending ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Memproses...</>
                ) : (
                  <><Package className="w-4 h-4" /> Konfirmasi Terima</>
                )}
              </button>
            )}
            {/* Cancel — can cancel while DRAFT or ACCEPTED */}
            {(request.status === 'DRAFT' || request.status === 'ACCEPTED') && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
              >
                <X className="w-4 h-4" /> Batalkan
              </button>
            )}
            {/* Print */}
            <select value={selectedPrinter} onChange={e => setSelectedPrinter(e.target.value)}
              className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white">
              <option value="">Printer...</option>
              {printers.map(p => <option key={p.id} value={p.id}>{p.printer_name}</option>)}
            </select>
            <button
              onClick={async () => {
                if (!selectedPrinter) { toast.error('Pilih printer dulu'); return }
                try {
                  await printMutation.mutateAsync({ prId: request.id, printer_id: selectedPrinter })
                  toast.success('Print job terkirim')
                } catch (err) { toast.error(parseApiError(err, 'Gagal print')) }
              }}
              disabled={!selectedPrinter || printMutation.isPending}
              className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> {printMutation.isPending ? '...' : 'Print'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Cabang Peminta</span>
              <p className="font-medium text-gray-900 dark:text-white">{request.requesting_branch_name}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Central / Pabrik</span>
              <p className="font-medium text-gray-900 dark:text-white">{request.fulfilling_branch_name}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Tanggal Request</span>
              <p className="font-medium text-gray-900 dark:text-white">{request.request_date}</p>
            </div>
          </div>
          {request.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
              <span className="text-gray-500 dark:text-gray-400 text-xs">Catatan</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{request.notes}</p>
            </div>
          )}
          {request.accept_notes && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
              <span className="text-blue-500 text-xs">Catatan Penerimaan Central</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{request.accept_notes}</p>
            </div>
          )}
          {request.receive_notes && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
              <span className="text-green-500 text-xs">Catatan Penerimaan Cabang</span>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{request.receive_notes}</p>
            </div>
          )}
          {request.stock_transfer_number && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60">
              <span className="text-gray-500 dark:text-gray-400 text-xs">Stock Transfer Terkait</span>
              <p className="text-sm font-medium text-blue-600">{request.stock_transfer_number}</p>
            </div>
          )}
        </div>

        {/* Lines */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/60">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Item yang Diminta</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500">Produk</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Qty Diminta</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Qty Disetujui</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Satuan</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {request.lines?.map(line => (
                <tr key={line.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{line.product_name}</div>
                    <div className="text-xs text-gray-400">{line.product_code}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{line.qty}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    {line.qty_approved !== null ? line.qty_approved : (request.status !== 'DRAFT' ? line.qty : '-')}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{line.uom}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{line.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Receive notes input (visible when ACCEPTED) */}
        {request.status === 'ACCEPTED' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5">
            <label className="text-xs text-gray-500 mb-1 block">Catatan penerimaan (opsional)</label>
            <textarea
              value={receiveNotes}
              onChange={e => setReceiveNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Catatan dari cabang..."
            />
          </div>
        )}
      </div>

      {/* Accept Dialog */}
      {showAcceptDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Terima & Proses Request</h3>
            <p className="text-sm text-gray-500 mb-4">Atur jumlah yang disetujui per item:</p>

            <div className="space-y-3 mb-4 max-h-60 overflow-auto">
              {request.lines?.map(line => (
                <div key={line.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{line.product_name}</p>
                    <p className="text-xs text-gray-400">Diminta: {line.qty} {line.uom}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={lineApprovals[line.id] ?? line.qty}
                      onChange={e => setLineApprovals(prev => ({ ...prev, [line.id]: parseFloat(e.target.value) || 0 }))}
                      className="w-20 px-2 py-1.5 text-right border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-500">{line.uom}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Catatan (opsional)</label>
              <textarea
                value={acceptNotes}
                onChange={e => setAcceptNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Catatan dari central..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAcceptDialog(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                onClick={handleAccept}
                disabled={acceptMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {acceptMutation.isPending ? 'Memproses...' : 'Konfirmasi Terima'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Batalkan Request</h3>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 mb-4"
              placeholder="Alasan pembatalan (opsional)..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Batal
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
              >
                Konfirmasi Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
