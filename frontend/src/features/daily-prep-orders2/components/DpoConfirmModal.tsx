import { useState } from 'react'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useAcquireDpoLock, useConfirmDpo } from '../api/dailyPrepOrders.api'
import type { DailyPrepOrder } from '../api/dailyPrepOrders.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'

const fmt = (n: number, unit?: string | null) =>
  `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n)}${unit ? ` ${unit}` : ''}`

interface Props {
  dpo: DailyPrepOrder
  onClose: () => void
  onConfirmed: () => void
}

export function DpoConfirmModal({ dpo, onClose, onConfirmed }: Props) {
  const toast = useToast()
  const acquireLock = useAcquireDpoLock()
  const confirmDpo = useConfirmDpo()
  const [lockToken, setLockToken] = useState<string | null>(null)
  const [step, setStep] = useState<'review' | 'confirming'>('review')

  const activeLines = (dpo.lines ?? []).filter(l => (l.confirmed_qty ?? 0) > 0)
  const skippedLines = (dpo.lines ?? []).filter(l => !((l.confirmed_qty ?? 0) > 0))

  const handleAcquireLock = async () => {
    try {
      const result = await acquireLock.mutateAsync(dpo.id)
      setLockToken(result.lock_token)
      setStep('confirming')
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal mengunci DPO'))
    }
  }

  const handleConfirm = async () => {
    if (!lockToken) return
    try {
      await confirmDpo.mutateAsync({ id: dpo.id, lock_token: lockToken })
      toast.success(`DPO ${dpo.dpo_number} berhasil dikonfirmasi`)
      onConfirmed()
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal konfirmasi'))
      setStep('review')
      setLockToken(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Konfirmasi Transfer</h2>
            <p className="text-xs text-gray-500">{dpo.dpo_number} · {dpo.source_warehouse_name} → {dpo.target_warehouse_name}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
          {/* Active lines */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Akan ditransfer ({activeLines.length} item)
            </p>
            <div className="space-y-1.5">
              {activeLines.map(line => (
                <div key={line.id} className="flex items-center justify-between py-1.5 px-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{line.product_name}</p>
                    <p className="text-xs text-gray-400 font-mono">{line.product_code}</p>
                  </div>
                  <span className="font-mono font-semibold text-green-700 dark:text-green-300 text-sm">
                    {fmt(line.confirmed_qty!, line.base_unit_name)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Skipped lines */}
          {skippedLines.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                Dilewati ({skippedLines.length} item, qty = 0)
              </p>
              <div className="space-y-1">
                {skippedLines.map(line => (
                  <div key={line.id} className="flex items-center justify-between py-1 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg opacity-60">
                    <p className="text-xs text-gray-500">{line.product_name}</p>
                    <span className="text-xs text-gray-400 font-mono">0 {line.base_unit_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          {step === 'confirming' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Setelah dikonfirmasi, stok <strong>{dpo.source_warehouse_name}</strong> akan berkurang
                dan stok <strong>{dpo.target_warehouse_name}</strong> akan bertambah. Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={acquireLock.isPending || confirmDpo.isPending}
            className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Batal
          </button>
          {step === 'review' ? (
            <button
              type="button"
              onClick={handleAcquireLock}
              disabled={acquireLock.isPending || activeLines.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-all"
            >
              {acquireLock.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Lanjut Konfirmasi
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirmDpo.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-all"
            >
              {confirmDpo.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Ya, Transfer Sekarang
            </button>
          )}
        </div>
      </div>
    </div>
  )
}