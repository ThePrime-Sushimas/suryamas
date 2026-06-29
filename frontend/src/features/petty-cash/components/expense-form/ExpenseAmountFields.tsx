import type { Dispatch, SetStateAction } from 'react'
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
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Qty ({uomName})</label>
            <input type="number" value={expenseForm.qty} onChange={(e) => {
              const qty = e.target.value
              const up = Number(expenseForm.unit_price) || 0
              setExpenseForm(f => ({ ...f, qty, amount: qty && up ? String(Number(qty) * up) : f.amount }))
            }} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Harga/{uomName}</label>
            <input type="number" value={expenseForm.unit_price} onChange={(e) => {
              const up = e.target.value
              const qty = Number(expenseForm.qty) || 0
              setExpenseForm(f => ({ ...f, unit_price: up, amount: up && qty ? String(Number(up) * qty) : f.amount }))
            }} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Total *</label>
            <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium" />
          </div>
        </div>
        {trackInventory && activeUom && (
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50">
            Masuk gudang: <strong className="font-semibold">{(Number(expenseForm.qty) || 0) * conversionFactor} {baseUomName}</strong> (Satuan Base)
          </div>
        )}
      </div>
    )
  }

  if (expenseMode === 'asset' && selectedAssetProduct) {
    return (
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Qty {selectedAssetCategory?.tracking_method === 'POOLED' ? '*' : ''}
          </label>
          <input
            type="number"
            value={expenseForm.asset_qty}
            disabled={selectedAssetCategory?.tracking_method !== 'POOLED'}
            onChange={(e) => {
              const qty = e.target.value
              const up = Number(expenseForm.unit_price) || 0
              setExpenseForm(f => ({
                ...f,
                asset_qty: qty,
                amount: qty && up ? String(Number(qty) * up) : f.amount,
              }))
            }}
            placeholder="1"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-900/50"
          />
          {selectedAssetCategory?.tracking_method !== 'POOLED' && (
            <p className="text-[10px] text-gray-400 mt-0.5">INDIVIDUAL: qty tetap 1</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Harga Satuan</label>
          <input
            type="number"
            value={expenseForm.unit_price}
            onChange={(e) => {
              const up = e.target.value
              const qty = Number(expenseForm.asset_qty) || 0
              setExpenseForm(f => ({
                ...f,
                unit_price: up,
                amount: up && qty ? String(Number(up) * qty) : f.amount,
              }))
            }}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Total *</label>
          <input
            type="number"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium"
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah *</label>
      <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
    </div>
  )
}
