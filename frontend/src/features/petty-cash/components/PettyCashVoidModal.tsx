import { useState } from 'react'
import { Loader2 } from 'lucide-react'
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
  const voidMutation = useVoidSettlement()
  const [reason, setReason] = useState('')

  const handleVoid = async () => {
    if (!reason.trim()) return
    try {
      await voidMutation.mutateAsync({ id: settlementId, requestId, reason: reason.trim() })
      toast.success('Settlement di-void')
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal void settlement')) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-red-600">Void Settlement</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Ini akan membatalkan settlement, reverse jurnal & stock movement, dan mengembalikan request ke status Aktif.</p>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Alasan *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Batal</button>
          <button onClick={handleVoid} disabled={voidMutation.isPending} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {voidMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Void Settlement'}
          </button>
        </div>
      </div>
    </div>
  )
}
