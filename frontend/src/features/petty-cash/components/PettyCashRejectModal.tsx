import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useRejectPettyCashRequest } from '../api/pettyCash.api'

interface PettyCashRejectModalProps {
  open: boolean
  onClose: () => void
  requestId: string
}

export function PettyCashRejectModal({ open, onClose, requestId }: PettyCashRejectModalProps) {
  const toast = useToast()
  const rejectMutation = useRejectPettyCashRequest()
  const [reason, setReason] = useState('')

  const handleReject = async () => {
    if (!reason.trim()) return
    try {
      await rejectMutation.mutateAsync({ id: requestId, rejection_reason: reason.trim() })
      toast.success('Request ditolak')
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal reject')) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tolak Request</h3>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Alasan Penolakan *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
          <button onClick={handleReject} disabled={rejectMutation.isPending} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tolak'}
          </button>
        </div>
      </div>
    </div>
  )
}
