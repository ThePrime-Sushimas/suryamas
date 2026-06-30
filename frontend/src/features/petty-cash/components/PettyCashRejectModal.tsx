import { useState } from 'react'
import { Dialog, Button, FormField, Textarea } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useRejectPettyCashRequest } from '../api/pettyCash.api'

interface PettyCashRejectModalProps {
  open: boolean
  onClose: () => void
  requestId: string
}

export function PettyCashRejectModal({ open, onClose, requestId }: PettyCashRejectModalProps) {
  const toast = useToast()
  const rejectMutation = useRejectPettyCashRequest()
  const [reason, setReason] = useState('')

  const handleClose = () => {
    if (rejectMutation.isPending) return
    onClose()
  }

  const handleReject = async () => {
    if (!reason.trim()) return
    try {
      await rejectMutation.mutateAsync({ id: requestId, rejection_reason: reason.trim() })
      toast.success('Request ditolak')
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal reject request')) }
  }

  return (
    <Dialog
      isOpen={open}
      onClose={handleClose}
      size="sm"
      preventClose={rejectMutation.isPending}
    >
      <Dialog.Header hideClose>Tolak Request</Dialog.Header>

      <Dialog.Body className="space-y-4">
        <FormField label="Alasan Penolakan" required>
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
        <Button variant="secondary" onClick={handleClose} disabled={rejectMutation.isPending}>
          Batal
        </Button>
        <Button variant="danger" loading={rejectMutation.isPending} onClick={handleReject}>
          Tolak Request
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
