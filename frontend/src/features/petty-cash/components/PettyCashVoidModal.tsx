import { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useVoidSettlement } from '../api/pettyCash.api'

interface PettyCashVoidModalProps {
  open: boolean
  onClose: () => void
  settlementId: string
  requestId: string
}

export function PettyCashVoidModal({ open, onClose, settlementId, requestId }: PettyCashVoidModalProps) {
  const toast = useToast()
  const qc = useQueryClient()
  const voidMutation = useVoidSettlement()
  const [reason, setReason] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleVoid = async () => {
    if (!reason.trim()) return
    setErrorMsg(null)
    try {
      await voidMutation.mutateAsync({ id: settlementId, requestId, reason: reason.trim() })
      toast.success('Settlement di-void')
      onClose()
    } catch (err) {
      const msg = parseApiError(err, 'Gagal void settlement')
      setErrorMsg(msg)
      // Refetch so can_void is up-to-date (guards race conditions where
      // another user activated the carry-forward between page load and void attempt).
      // Backend already enforces this rule independently.
      qc.invalidateQueries({ queryKey: ['petty-cash', 'detail', requestId] })
    }
  }

  const handleClose = () => {
    setErrorMsg(null)
    setReason('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-red-600">Void Settlement</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Ini akan membatalkan settlement dan me-reverse jurnal settlement. Request akan kembali ke status <strong>DISBURSED</strong>.
        </p>

        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{errorMsg}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Alasan *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
          <button onClick={handleVoid} disabled={voidMutation.isPending || !reason.trim()} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {voidMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Void Settlement'}
          </button>
        </div>
      </div>
    </div>
  )
}
