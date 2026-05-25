import { useState, useEffect, useCallback, useRef } from 'react'
import { X, CheckCircle2, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useAcquireLock, useConfirmDpo } from '../api/dpo.queries'
import type { DailyPrepOrderDetail } from '../types/dpo.types'

const formatQty = (n: number) => parseFloat(n.toFixed(4)).toString()

interface DpoConfirmDialogProps {
  dpo: DailyPrepOrderDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DpoConfirmDialog({ dpo, open, onOpenChange }: DpoConfirmDialogProps) {
  const toast = useToast()
  const acquireLockMutation = useAcquireLock(dpo.id)
  const confirmMutation = useConfirmDpo(dpo.id)

  const [lockToken, setLockToken] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(300)
  const [isExpired, setIsExpired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const activeLines = dpo.lines.filter((l) => (l.confirmed_qty ?? 0) > 0)

  const startCountdown = useCallback(() => {
    setSecondsLeft(300)
    setIsExpired(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setIsExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const doAcquireLock = useCallback(() => {
    setError(null)
    acquireLockMutation.mutate(undefined, {
      onSuccess: (data) => {
        setLockToken(data.lock_token)
        startCountdown()
      },
      onError: (err) => {
        setError(parseApiError(err, 'Gagal mengambil lock'))
      },
    })
  }, [acquireLockMutation, startCountdown])

  // Acquire lock when dialog opens
  useEffect(() => {
    if (open) {
      doAcquireLock()
    } else {
      // Cleanup on close
      setLockToken(null)
      setSecondsLeft(300)
      setIsExpired(false)
      setError(null)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleConfirm = () => {
    if (!lockToken) return
    setError(null)
    confirmMutation.mutate(
      { lock_token: lockToken },
      {
        onSuccess: () => {
          toast.success('DPO berhasil dikonfirmasi')
          onOpenChange(false)
        },
        onError: (err) => {
          const msg = parseApiError(err, 'Gagal mengkonfirmasi DPO')
          setError(msg)
        },
      }
    )
  }

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60)
    const sec = s % 60
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  if (!open) return null

  const isLoading = acquireLockMutation.isPending || confirmMutation.isPending
  const canConfirm = lockToken && !isExpired && !confirmMutation.isPending && !acquireLockMutation.isPending

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70"
      style={{ pointerEvents: isLoading ? 'none' : 'auto' }}
      onMouseDown={(e) => {
        if (!isLoading && e.target === e.currentTarget) onOpenChange(false)
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Konfirmasi DPO
            </h3>
            {lockToken && (
              <div className={`mt-1 text-sm font-mono ${isExpired ? 'text-red-600 dark:text-red-400' : secondsLeft <= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}`}>
                ⏱ {formatTime(secondsLeft)}
              </div>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Expired message */}
        {isExpired && (
          <div className="mb-4 flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">Sesi konfirmasi sudah expired.</p>
            <button
              onClick={doAcquireLock}
              disabled={acquireLockMutation.isPending}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
            >
              <RefreshCw className="h-3 w-3" /> Muat Ulang
            </button>
          </div>
        )}

        {/* Loading state */}
        {acquireLockMutation.isPending && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-gray-500">Mengambil lock...</span>
          </div>
        )}

        {/* Summary table */}
        {lockToken && !acquireLockMutation.isPending && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {activeLines.length} item akan di-transfer dari <strong>{dpo.source_warehouse_name}</strong> ke <strong>{dpo.target_warehouse_name}</strong>:
            </p>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg mb-4 max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Produk</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">UOM</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {activeLines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{line.product_name}</td>
                      <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">{line.uom}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">{formatQty(line.confirmed_qty!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 text-sm"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 text-sm font-medium"
          >
            {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {confirmMutation.isPending ? 'Mengkonfirmasi...' : 'Ya, Konfirmasi'}
          </button>
        </div>
      </div>
    </div>
  )
}
