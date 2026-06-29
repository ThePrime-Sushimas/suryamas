import type { Dispatch, SetStateAction } from 'react'
import {
  Dialog,
  Button,
  FormField,
  Select,
  Textarea,
  CurrencyInput,
} from '@/components/ui'
import type { CreatePettyCashRequestForm } from '../hooks/useCreatePettyCashRequestForm'

interface BranchOption {
  id: string
  branch_name: string
}

interface CoaOption {
  id: string
  account_code: string
  account_name: string
}

export interface PettyCashCreateModalProps {
  onClose: () => void
  form: CreatePettyCashRequestForm
  setForm: Dispatch<SetStateAction<CreatePettyCashRequestForm>>
  onSubmit: () => void
  isPending: boolean
  branches: BranchOption[]
  pettyCashCoaOptions: CoaOption[]
}

export function PettyCashCreateModal({
  onClose,
  form,
  setForm,
  onSubmit,
  isPending,
  branches,
  pettyCashCoaOptions,
}: PettyCashCreateModalProps) {
  const handleClose = () => {
    if (isPending) return
    onClose()
  }

  return (
    <Dialog
      isOpen
      onClose={handleClose}
      size="md"
      preventClose={isPending}
    >
      <Dialog.Header>Buat Request Kas Kecil</Dialog.Header>

      <Dialog.Body className="space-y-4">
        <FormField label="Cabang" required>
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={form.branch_id}
              onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
            >
              <option value="">Pilih cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Jumlah Diajukan" required>
          {({ inputId, describedBy }) => (
            <CurrencyInput
              id={inputId}
              aria-describedby={describedBy}
              value={form.amount_requested}
              onChange={(value) => setForm((f) => ({ ...f, amount_requested: value }))}
            />
          )}
        </FormField>

        <FormField label="COA Kas Kecil" required>
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={form.petty_cash_coa_id}
              onChange={(e) => setForm((f) => ({ ...f, petty_cash_coa_id: e.target.value }))}
            >
              <option value="">Pilih akun</option>
              {pettyCashCoaOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.account_code} — {c.account_name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Keterangan">
          {({ inputId, describedBy }) => (
            <Textarea
              id={inputId}
              aria-describedby={describedBy}
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          )}
        </FormField>
      </Dialog.Body>

      <Dialog.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={isPending}>
          Batal
        </Button>
        <Button variant="primary" loading={isPending} onClick={onSubmit}>
          Buat Request
        </Button>
      </Dialog.Footer>
    </Dialog>
  )
}
