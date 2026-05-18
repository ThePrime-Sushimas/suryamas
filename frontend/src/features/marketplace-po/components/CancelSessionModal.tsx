import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { MarketplaceSessionStatus } from '../types/marketplacePo.types'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: { cancel_reason: string; platform_cancel_ref?: string }) => void
  isLoading: boolean
  status: MarketplaceSessionStatus
}

export function CancelSessionModal({ isOpen, onClose, onConfirm, isLoading, status }: Props) {
  const [reason, setReason] = useState('')
  const [ref, setRef] = useState('')

  if (!isOpen) return null

  const statusLabel = status === 'ORDERED' ? 'ORDERED (belum ada resi)' : 'SHIPPED (barang di jalan)'

  const handleSubmit = () => {
    if (reason.trim().length < 5) return
    onConfirm({
      cancel_reason: reason.trim(),
      platform_cancel_ref: ref.trim() || undefined,
    })
  }

  const handleClose = () => {
    if (isLoading) return
    setReason('')
    setRef('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Batalkan Pesanan</h2>
              <p className="text-xs text-gray-500 mt-0.5">Status saat ini: {statusLabel}</p>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
            Jurnal checkout akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alasan pembatalan <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Contoh: Platform membatalkan karena stok habis"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              {reason.trim().length > 0 && reason.trim().length < 5 && (
                <p className="text-xs text-red-500 mt-1">Minimal 5 karakter</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                No. Referensi Pembatalan Platform{' '}
                <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <input
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="Contoh: REF-SHOPEE-12345"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || reason.trim().length < 5}
            className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : 'Ya, Batalkan'}
          </button>
        </div>
      </div>
    </div>
  )
}
