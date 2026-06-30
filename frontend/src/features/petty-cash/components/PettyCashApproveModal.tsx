import { useState, useCallback, useEffect } from 'react'
import { Dialog, Button, FormField, Select, Textarea, CurrencyInput } from '@/components/ui'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCompanyBankAccounts } from '@/features/ap-payments/hooks/useCompanyBankAccounts'
import { useApprovePettyCashRequest } from '../api/pettyCash.api'

interface PettyCashApproveModalProps {
  open: boolean
  onClose: () => void
  requestId: string
  defaultAmount: number
}

export function PettyCashApproveModal({ open, onClose, requestId, defaultAmount }: PettyCashApproveModalProps) {
  const toast = useToast()
  const { data: bankAccounts = [] } = useCompanyBankAccounts()
  const approveMutation = useApprovePettyCashRequest()

  const [form, setForm] = useState({
    source_bank_account_id: '',
    amount_disbursed: defaultAmount as number | '',
    notes: '',
  })

  const resetForm = useCallback(() => {
    setForm({ source_bank_account_id: '', amount_disbursed: defaultAmount, notes: '' })
  }, [defaultAmount])

  useEffect(() => {
    if (open) resetForm()
  }, [open, resetForm])

  const handleClose = () => {
    if (approveMutation.isPending) return
    resetForm()
    onClose()
  }

  const handleApprove = async () => {
    if (!form.source_bank_account_id || form.amount_disbursed === '') return
    try {
      await approveMutation.mutateAsync({
        id: requestId,
        source_bank_account_id: Number(form.source_bank_account_id),
        amount_disbursed: form.amount_disbursed,
        notes: form.notes || undefined,
      })
      toast.success('Request disetujui & dicairkan')
      onClose()
    } catch (err) { toast.error(parseApiError(err, 'Gagal approve request')) }
  }

  return (
    <Dialog
      isOpen={open}
      onClose={handleClose}
      size="md"
      preventClose={approveMutation.isPending}
    >
      <Dialog.Header>Approve & Cairkan</Dialog.Header>

      <Dialog.Body className="space-y-4">
        <FormField label="Sumber Bank" required>
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={form.source_bank_account_id}
              onChange={(e) => setForm((f) => ({ ...f, source_bank_account_id: e.target.value }))}
            >
              <option value="">Pilih rekening</option>
              {bankAccounts.map((ba) => (
                <option key={ba.id} value={ba.id}>
                  {ba.bank_name} · {ba.account_number} · {ba.account_name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Jumlah Dicairkan" required>
          {({ inputId, describedBy }) => (
            <CurrencyInput
              id={inputId}
              aria-describedby={describedBy}
              value={form.amount_disbursed}
              onChange={(value) => setForm((f) => ({ ...f, amount_disbursed: value }))}
            />
          )}
        </FormField>

        <FormField label="Catatan">
          {({ inputId, describedBy }) => (
            <Textarea
              id={inputId}
              aria-describedby={describedBy}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          )}
        </FormField>
      </Dialog.Body>

      <Dialog.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={approveMutation.isPending}>
          Batal
        </Button>
        <Button variant="primary" loading={approveMutation.isPending} onClick={handleApprove}>
          Approve & Cairkan
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
