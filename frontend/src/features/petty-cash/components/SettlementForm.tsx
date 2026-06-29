import type { Dispatch, SetStateAction } from 'react'
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Tanggal Settlement
        </label>
        <input
          type="date"
          value={form.settlement_date}
          onChange={(e) =>
            setForm((f) => ({ ...f, settlement_date: e.target.value }))
          }
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Jumlah Dikembalikan ke Bank
        </label>
        <input
          type="number"
          value={form.amount_returned}
          onChange={(e) =>
            setForm((f) => ({ ...f, amount_returned: e.target.value }))
          }
          min="0"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        />
      </div>
      {amountReturned > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Rekening Pengembalian *
          </label>
          <select
            value={form.return_bank_account_id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                return_bank_account_id: e.target.value,
              }))
            }
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="">Pilih rekening</option>
            {bankAccounts.map((ba) => (
              <option key={ba.id} value={ba.id}>
                {ba.bank_name} · {ba.account_number} . {ba.account_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Jumlah Refill (tambahan dari bank)
        </label>
        <input
          type="number"
          value={form.refill_amount}
          onChange={(e) =>
            setForm((f) => ({ ...f, refill_amount: e.target.value }))
          }
          min="0"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        />
      </div>
      {refillAmount > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Rekening Refill *
          </label>
          <select
            value={form.refill_bank_account_id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                refill_bank_account_id: e.target.value,
              }))
            }
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="">Pilih rekening</option>
            {bankAccounts.map((ba) => (
              <option key={ba.id} value={ba.id}>
                {ba.bank_name} · {ba.account_number} . {ba.account_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Catatan
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        />
      </div>
    </div>
  )
}
