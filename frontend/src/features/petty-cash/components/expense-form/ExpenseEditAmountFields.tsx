import type { Dispatch, SetStateAction } from 'react'
import { FormField, Input, CurrencyInput } from '@/components/ui'
import type { ProductUom } from '@/features/product-uoms/types'
import type { ExpenseEditFormState } from '../../hooks/useExpenseEditForm'

export interface ExpenseEditAmountFieldsProps {
  form: ExpenseEditFormState
  setForm: Dispatch<SetStateAction<ExpenseEditFormState>>
  uomName: string
  showInventoryHint: boolean
  activeUom: ProductUom | undefined
  conversionFactor: number
  baseUomName: string
  onQtyChange: (qty: string) => void
  onUnitPriceChange: (unit_price: string) => void
}

export function ExpenseEditAmountFields({
  form,
  setForm,
  uomName,
  showInventoryHint,
  activeUom,
  conversionFactor,
  baseUomName,
  onQtyChange,
  onUnitPriceChange,
}: ExpenseEditAmountFieldsProps) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-3">
        <FormField label={`Qty (${uomName})`}>
          {({ inputId, describedBy }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              type="number"
              value={form.qty}
              onChange={(e) => onQtyChange(e.target.value)}
              placeholder="—"
              min="0"
              step="0.01"
            />
          )}
        </FormField>

        <FormField label={`Harga/${uomName}`}>
          {({ inputId, describedBy }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              type="number"
              value={form.unit_price}
              onChange={(e) => onUnitPriceChange(e.target.value)}
              placeholder="—"
              min="0"
            />
          )}
        </FormField>

        <FormField label="Total" required>
          {({ inputId, describedBy }) => (
            <CurrencyInput
              id={inputId}
              aria-describedby={describedBy}
              value={form.amount}
              onChange={(value) =>
                setForm((f) => ({ ...f, amount: value }))
              }
            />
          )}
        </FormField>
      </div>

      {showInventoryHint && activeUom && (
        <div className="mt-1 rounded-lg border border-blue-100 bg-blue-50/50 p-2 text-xs font-medium text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">
          Masuk gudang:{' '}
          <strong className="font-semibold">
            {(Number(form.qty) || 0) * conversionFactor} {baseUomName}
          </strong>{' '}
          (Satuan Base)
        </div>
      )}
    </div>
  )
}
