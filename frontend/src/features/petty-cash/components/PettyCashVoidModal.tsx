import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, Button, FormField, Textarea } from '@/components/ui'
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
    if (voidMutation.isPending) return
    setErrorMsg(null)
    setReason('')
    onClose()
  }

  return (
    <Dialog
      isOpen={open}
      onClose={handleClose}
      size="md"
      preventClose={voidMutation.isPending}
    >
      <Dialog.Header>Void Settlement</Dialog.Header>

      <Dialog.Body className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Ini akan membatalkan settlement dan me-reverse jurnal settlement. Request akan kembali ke status <strong>DISBURSED</strong>.
        </p>

        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{errorMsg}</p>
          </div>
        )}

        <FormField label="Alasan" required>
          {({ inputId, describedBy }) => (
            <Textarea
              id={inputId}
              aria-describedby={describedBy}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </FormField>
      </Dialog.Body>

      <Dialog.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={voidMutation.isPending}>
          Batal
        </Button>
        <Button
          variant="danger"
          loading={voidMutation.isPending}
          disabled={!reason.trim()}
          onClick={handleVoid}
        >
          Void Settlement
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
