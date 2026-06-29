import type { Dispatch, SetStateAction } from 'react'
import {
  FormField,
  DateInput,
  CurrencyInput,
  Select,
  Textarea,
} from '@/components/ui'
import type { CompanyBankAccount } from '@/features/ap-payments/hooks/useCompanyBankAccounts'
import type { SettlementFormState } from '../hooks/useSettlementForm'

type SettlementFormProps = {
  form: SettlementFormState
  setForm: Dispatch<SetStateAction<SettlementFormState>>
  amountReturned: number
  refillAmount: number
  bankAccounts: CompanyBankAccount[]
}

export function SettlementForm({
  form,
  setForm,
  amountReturned,
  refillAmount,
  bankAccounts,
}: SettlementFormProps) {
  return (
    <div className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <FormField label="Tanggal Settlement">
        {({ inputId, describedBy }) => (
          <DateInput
            id={inputId}
            aria-describedby={describedBy}
            value={form.settlement_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, settlement_date: e.target.value }))
            }
          />
        )}
      </FormField>

      <FormField label="Jumlah Dikembalikan ke Bank">
        {({ inputId, describedBy }) => (
          <CurrencyInput
            id={inputId}
            aria-describedby={describedBy}
            value={form.amount_returned}
            onChange={(value) =>
              setForm((f) => ({ ...f, amount_returned: value }))
            }
          />
        )}
      </FormField>

      {amountReturned > 0 && (
        <FormField label="Rekening Pengembalian" required>
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={form.return_bank_account_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  return_bank_account_id: e.target.value,
                }))
              }
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
      )}

      <FormField label="Jumlah Refill (tambahan dari bank)">
        {({ inputId, describedBy }) => (
          <CurrencyInput
            id={inputId}
            aria-describedby={describedBy}
            value={form.refill_amount}
            onChange={(value) =>
              setForm((f) => ({ ...f, refill_amount: value }))
            }
          />
        )}
      </FormField>

      {refillAmount > 0 && (
        <FormField label="Rekening Refill" required>
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={form.refill_bank_account_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  refill_bank_account_id: e.target.value,
                }))
              }
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
      )}

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
    </div>
  )
}
