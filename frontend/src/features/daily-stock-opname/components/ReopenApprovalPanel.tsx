import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, Clock, User } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import {
  useApproveReopenRequest,
  useRejectReopenRequest,
} from '../api/dailyStockOpname'
import type { OpnameReopenRequestWithRelations } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReopenApprovalPanelProps {
  pendingRequest: OpnameReopenRequestWithRelations
  sessionId: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ReopenApprovalPanel = ({
  pendingRequest,
  sessionId,
}: ReopenApprovalPanelProps) => {
  const toast = useToast()
  const [responseNote, setResponseNote] = useState('')

  const approveMutation = useApproveReopenRequest()
  const rejectMutation = useRejectReopenRequest()

  const isPending = approveMutation.isPending || rejectMutation.isPending

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({
        requestId: pendingRequest.id,
        sessionId,
        body: responseNote.trim() ? { response_note: responseNote.trim() } : {},
      })
      toast.success('Permintaan edit ulang disetujui')
      setResponseNote('')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal menyetujui permintaan'))
    }
  }

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({
        requestId: pendingRequest.id,
        sessionId,
        body: responseNote.trim() ? { response_note: responseNote.trim() } : {},
      })
      toast.success('Permintaan edit ulang ditolak')
      setResponseNote('')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal menolak permintaan'))
    }
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Permintaan Edit Ulang Menunggu Persetujuan
          </h4>
          <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <p className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-medium">{pendingRequest.requested_by_name}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {fmtDateTime(pendingRequest.requested_at)}
            </p>
          </div>
          <div className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {pendingRequest.reason}
            </p>
          </div>
        </div>
      </div>

      {/* Response note textarea */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Catatan balasan (opsional)
        </label>
        <textarea
          value={responseNote}
          onChange={(e) => setResponseNote(e.target.value)}
          placeholder="Tambahkan catatan..."
          rows={2}
          disabled={isPending}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none disabled:opacity-50 resize-none"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {approveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Setujui
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {rejectMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          Tolak
        </button>
      </div>
    </div>
  )
}
