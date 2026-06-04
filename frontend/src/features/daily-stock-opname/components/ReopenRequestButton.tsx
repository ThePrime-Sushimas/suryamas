import { useState } from 'react'
import { RotateCcw, X, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/features/auth'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateReopenRequest } from '../api/dailyStockOpname'
import type { OpnameStatus } from '../types'

interface ReopenRequestButtonProps {
  sessionId: string
  sessionStatus: OpnameStatus
  picUserId: string
  hasPendingRequest: boolean
}

export function ReopenRequestButton({
  sessionId,
  sessionStatus,
  picUserId,
  hasPendingRequest,
}: ReopenRequestButtonProps) {
  const currentUser = useAuthStore((s) => s.user)
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canUpdate = hasPermission('daily_stock_opname', 'update')
  const toast = useToast()
  const createReopenRequest = useCreateReopenRequest()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState('')

  // Only render when eligible
  const isEligibleStatus = sessionStatus === 'CONFIRMED' || sessionStatus === 'FLAGGED'
  const isPic = currentUser?.id === picUserId
  const canRequest = isPic || canUpdate

  if (!isEligibleStatus || !canRequest || hasPendingRequest) {
    return null
  }

  const isValid = reason.trim().length > 0

  const handleOpen = () => {
    setIsDialogOpen(true)
    setReason('')
    setValidationError('')
  }

  const handleClose = () => {
    if (createReopenRequest.isPending) return
    setIsDialogOpen(false)
    setReason('')
    setValidationError('')
  }

  const handleSubmit = () => {
    if (!reason.trim()) {
      setValidationError('Alasan wajib diisi')
      return
    }
    setValidationError('')

    createReopenRequest.mutate(
      { sessionId, body: { reason: reason.trim() } },
      {
        onSuccess: () => {
          toast.success('Permintaan edit ulang berhasil diajukan')
          handleClose()
        },
        onError: (err) => {
          toast.error(parseApiError(err, 'Gagal mengajukan permintaan edit ulang'))
        },
      },
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Minta Izin Edit
      </button>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <RotateCcw className="w-5 h-5" />
                <h3 className="font-semibold">Minta Izin Edit Ulang</h3>
              </div>
              <button
                onClick={handleClose}
                disabled={createReopenRequest.isPending}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Berikan alasan mengapa Anda perlu mengedit ulang sesi opname ini. Permintaan akan dikirim ke approver untuk disetujui.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Alasan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    if (validationError) setValidationError('')
                  }}
                  placeholder="Jelaskan alasan edit ulang..."
                  rows={4}
                  disabled={createReopenRequest.isPending}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50"
                />
                {validationError && (
                  <p className="text-xs text-red-500 mt-1">{validationError}</p>
                )}
              </div>

              {createReopenRequest.isError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                  {parseApiError(createReopenRequest.error, 'Gagal mengajukan permintaan edit ulang')}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleClose}
                disabled={createReopenRequest.isPending}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isValid || createReopenRequest.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {createReopenRequest.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Kirim Permintaan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
