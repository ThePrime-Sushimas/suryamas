import type { Dispatch, SetStateAction } from 'react'
import { FormField, Input, CurrencyInput } from '@/components/ui'
import type { AssetCategory } from '@/features/fixed-assets/api/fixed-assets.api'
import type { ProductUom } from '@/features/product-uoms/types'
import type {
  ExpenseFormState,
  ExpenseMode,
  SelectedAssetExpenseProduct,
  SelectedExpenseProduct,
} from '../../hooks/useExpenseFormModal'

export interface ExpenseAmountFieldsProps {
  expenseMode: ExpenseMode
  expenseForm: ExpenseFormState
  setExpenseForm: Dispatch<SetStateAction<ExpenseFormState>>
  selectedProduct: SelectedExpenseProduct | null
  selectedAssetProduct: SelectedAssetExpenseProduct | null
  selectedAssetCategory: AssetCategory | undefined
  uomName: string
  trackInventory: boolean
  activeUom: ProductUom | undefined
  conversionFactor: number
  baseUomName: string
}

function lineTotal(qty: string, unitPrice: string): number | '' {
  const q = Number(qty)
  const up = Number(unitPrice)
  if (!qty || !unitPrice || !q || !up) return ''
  return q * up
}

export function ExpenseAmountFields({
  expenseMode,
  expenseForm,
  setExpenseForm,
  selectedProduct,
  selectedAssetProduct,
  selectedAssetCategory,
  uomName,
  trackInventory,
  activeUom,
  conversionFactor,
  baseUomName,
}: ExpenseAmountFieldsProps) {
  if (expenseMode === 'product' && selectedProduct) {
    return (
      <div className="space-y-1.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label={`Qty (${uomName})`}>
            {({ inputId, describedBy }) => (
              <Input
                id={inputId}
                aria-describedby={describedBy}
                type="number"
                value={expenseForm.qty}
                onChange={(e) => {
                  const qty = e.target.value
                  const computed = lineTotal(qty, expenseForm.unit_price)
                  setExpenseForm((f) => ({
                    ...f,
                    qty,
                    amount: computed !== '' ? computed : f.amount,
                  }))
                }}
                placeholder="0"
                min="0"
              />
            )}
          </FormField>

          <FormField label={`Harga/${uomName}`}>
            {({ inputId, describedBy }) => (
              <Input
                id={inputId}
                aria-describedby={describedBy}
                type="number"
                value={expenseForm.unit_price}
                onChange={(e) => {
                  const unit_price = e.target.value
                  const computed = lineTotal(expenseForm.qty, unit_price)
                  setExpenseForm((f) => ({
                    ...f,
                    unit_price,
                    amount: computed !== '' ? computed : f.amount,
                  }))
                }}
                placeholder="0"
                min="0"
              />
            )}
          </FormField>

          <FormField label="Total" required>
            {({ inputId, describedBy }) => (
              <CurrencyInput
                id={inputId}
                aria-describedby={describedBy}
                value={expenseForm.amount}
                onChange={(value) =>
                  setExpenseForm((f) => ({ ...f, amount: value }))
                }
              />
            )}
          </FormField>
        </div>

        {trackInventory && activeUom && (
          <div className="mt-1 rounded-lg border border-blue-100 bg-blue-50/50 p-2 text-xs text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">
            Masuk gudang:{' '}
            <strong className="font-semibold">
              {(Number(expenseForm.qty) || 0) * conversionFactor} {baseUomName}
            </strong>{' '}
            (Satuan Base)
          </div>
        )}
      </div>
    )
  }

  if (expenseMode === 'asset' && selectedAssetProduct) {
    const isPooled = selectedAssetCategory?.tracking_method === 'POOLED'

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField
          label="Qty"
          required={isPooled}
          helperText={!isPooled ? 'INDIVIDUAL: qty tetap 1' : undefined}
        >
          {({ inputId, describedBy }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              type="number"
              value={expenseForm.asset_qty}
              disabled={!isPooled}
              onChange={(e) => {
                const asset_qty = e.target.value
                const computed = lineTotal(asset_qty, expenseForm.unit_price)
                setExpenseForm((f) => ({
                  ...f,
                  asset_qty,
                  amount: computed !== '' ? computed : f.amount,
                }))
              }}
              placeholder="1"
              min="0"
            />
          )}
        </FormField>

        <FormField label="Harga Satuan">
          {({ inputId, describedBy }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              type="number"
              value={expenseForm.unit_price}
              onChange={(e) => {
                const unit_price = e.target.value
                const computed = lineTotal(expenseForm.asset_qty, unit_price)
                setExpenseForm((f) => ({
                  ...f,
                  unit_price,
                  amount: computed !== '' ? computed : f.amount,
                }))
              }}
              placeholder="0"
              min="0"
            />
          )}
        </FormField>

        <FormField label="Total" required>
          {({ inputId, describedBy }) => (
            <CurrencyInput
              id={inputId}
              aria-describedby={describedBy}
              value={expenseForm.amount}
              onChange={(value) =>
                setExpenseForm((f) => ({ ...f, amount: value }))
              }
            />
          )}
        </FormField>
      </div>
    )
  }

  return (
    <FormField label="Jumlah" required>
      {({ inputId, describedBy }) => (
        <CurrencyInput
          id={inputId}
          aria-describedby={describedBy}
          value={expenseForm.amount}
          onChange={(value) =>
            setExpenseForm((f) => ({ ...f, amount: value }))
          }
        />
      )}
    </FormField>
  )
}
