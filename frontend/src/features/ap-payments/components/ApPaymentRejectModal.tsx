import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { apTheme } from '../ap-payments.theme'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
  isLoading?: boolean
}

export function ApPaymentRejectModal({ isOpen, onClose, onSubmit, isLoading }: Props) {
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  const handleSubmit = async () => {
    const trimmed = reason.trim()
    if (!trimmed) return
    try {
      await onSubmit(trimmed)
      setReason('')
      onClose()
    } catch {
      /* caller toast */
    }
  }

  return (
    <div
      className={apTheme.modalOverlay}
      onClick={onClose}
    >
      <div
        className={`${apTheme.modal} max-w-md`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tolak pembayaran</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-5">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Alasan penolakan *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className={`${apTheme.input} resize-none`}
            placeholder="Jelaskan alasan penolakan..."
          />
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className={apTheme.btnSecondary}
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!reason.trim() || isLoading}
            onClick={() => void handleSubmit()}
            className="px-4 py-2.5 rounded-2xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 inline-flex items-center gap-2 shadow-sm"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Tolak
          </button>
        </div>
      </div>
    </div>
  )
}
