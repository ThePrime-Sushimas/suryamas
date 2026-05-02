import { useState } from 'react'
import { AlertTriangle, X, Loader2 } from 'lucide-react'

interface CloseBranchModalProps {
  branchName: string
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string, closedDate: string) => Promise<void>
}

export const CloseBranchModal = ({ branchName, isOpen, onClose, onConfirm }: CloseBranchModalProps) => {
  const [reason, setReason] = useState('')
  const [closedDate, setClosedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const isValid = reason.trim().length >= 5 && closedDate.length === 10

  const handleConfirm = async () => {
    if (!isValid) return
    setLoading(true)
    setError('')
    try {
      await onConfirm(reason.trim(), closedDate)
      setReason('')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menutup cabang')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setReason('')
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold">Tutup Cabang Permanen</h3>
          </div>
          <button onClick={handleClose} disabled={loading} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Cabang <strong>"{branchName}"</strong> akan ditutup secara permanen. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
          </p>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
            <p>Setelah ditutup:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Tidak bisa membuat transaksi baru</li>
              <li>Data historis tetap bisa dilihat</li>
              <li>Status tidak bisa diubah kembali</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tanggal tutup operasional <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={closedDate}
              onChange={(e) => setClosedDate(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tanggal cabang berhenti beroperasi</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Alasan penutupan <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Minimal 5 karakter..."
              rows={3}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none disabled:opacity-50"
            />
            {reason.length > 0 && reason.trim().length < 5 && (
              <p className="text-xs text-red-500 mt-1">Minimal 5 karakter</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Tutup Cabang Permanen
          </button>
        </div>
      </div>
    </div>
  )
}
