import type { Dispatch, SetStateAction } from 'react'
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
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Qty ({uomName})
          </label>
          <input type="number" value={form.qty} onChange={(e) => onQtyChange(e.target.value)} placeholder="—" min="0" step="0.01" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Harga/{uomName}
          </label>
          <input type="number" value={form.unit_price} onChange={(e) => onUnitPriceChange(e.target.value)} placeholder="—" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Total *</label>
          <input type="number" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" min="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium" />
        </div>
      </div>
      {showInventoryHint && activeUom && (
        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50 font-medium">
          Masuk gudang: <strong className="font-semibold">{(Number(form.qty) || 0) * conversionFactor} {baseUomName}</strong> (Satuan Base)
        </div>
      )}
    </div>
  )
}
