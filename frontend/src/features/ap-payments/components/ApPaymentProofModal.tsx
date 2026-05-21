import { useState } from 'react'
import { X, Link2, Loader2 } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (proofUrl: string) => Promise<void>
  isLoading?: boolean
}

export function ApPaymentProofModal({ isOpen, onClose, onSubmit, isLoading }: Props) {
  const [proofUrl, setProofUrl] = useState('')

  if (!isOpen) return null

  const handleSubmit = async () => {
    const trimmed = proofUrl.trim()
    if (!trimmed) return
    try {
      await onSubmit(trimmed)
      setProofUrl('')
      onClose()
    } catch {
      /* caller shows toast */
    }
  }

  const validUrl = (() => {
    try {
      return !!new URL(proofUrl.trim())
    } catch {
      return false
    }
  })()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload bukti bayar</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tempel URL bukti transfer (screenshot / file yang sudah di-host). URL harus dapat diakses.
          </p>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://..."
              className="w-full pl-9 pr-3 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl text-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!validUrl || isLoading}
            onClick={() => void handleSubmit()}
            className="px-4 py-2.5 rounded-2xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan bukti
          </button>
        </div>
      </div>
    </div>
  )
}
