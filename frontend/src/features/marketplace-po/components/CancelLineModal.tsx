import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  isOpen: boolean
  productName: string
  onClose: () => void
  onConfirm: (cancelReason: string) => void
  isLoading: boolean
}

export function CancelLineModal({ isOpen, productName, onClose, onConfirm, isLoading }: Props) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!isOpen) setReason('')
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = () => {
    if (reason.trim().length < 3) return
    onConfirm(reason.trim())
  }

  const handleClose = () => {
    if (isLoading) return
    setReason('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Batalkan Item?
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          <strong className="text-gray-800 dark:text-gray-200">{productName}</strong> akan dibatalkan
          dan jurnal koreksi akan otomatis dibuat untuk menyesuaikan nilai yang sudah tercatat.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Alasan pembatalan <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Dibatalkan oleh marketplace karena stok habis"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl
                       bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white
                       placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {reason.trim().length > 0 && reason.trim().length < 3 && (
            <p className="text-xs text-red-500 mt-1">Minimal 3 karakter</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl
                       text-sm font-medium text-gray-700 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={reason.trim().length < 3 || isLoading}
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600
                       disabled:opacity-50 text-white rounded-xl text-sm font-medium"
          >
            {isLoading ? 'Memproses...' : 'Ya, Batalkan Item'}
          </button>
        </div>
      </div>
    </div>
  )
}
