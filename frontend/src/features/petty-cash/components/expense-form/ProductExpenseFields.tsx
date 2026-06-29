import { X } from 'lucide-react'
import { FormField, Select } from '@/components/ui'
import type { Category } from '@/features/categories/types'
import type { ProductUom } from '@/features/product-uoms/types'
import type {
  ExpenseFormState,
  SelectedExpenseProduct,
} from '../../hooks/useExpenseFormModal'

export interface ProductExpenseFieldsProps {
  expenseForm: ExpenseFormState
  categories: Category[]
  selectedProduct: SelectedExpenseProduct | null
  uoms: ProductUom[]
  selectedUomId: string
  onOpenProductPicker: () => void
  onClearSelectedProduct: () => void
  onSelectedUomIdChange: (uomId: string) => void
}

export function ProductExpenseFields({
  expenseForm,
  categories,
  selectedProduct,
  uoms,
  selectedUomId,
  onOpenProductPicker,
  onClearSelectedProduct,
  onSelectedUomIdChange,
}: ProductExpenseFieldsProps) {
  return (
    <div className="space-y-4">
      <FormField label="Produk" required>
        {selectedProduct ? (
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            <div>
              <span className="font-medium text-gray-900 dark:text-white">
                {selectedProduct.product_name}
              </span>
              {expenseForm.category_id && (
                <span className="ml-2 text-xs text-gray-500">
                  ({categories.find((c) => c.id === expenseForm.category_id)?.category_name})
                </span>
              )}
            </div>
            <button type="button" onClick={onClearSelectedProduct}>
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenProductPicker}
            className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-600"
          >
            Klik untuk cari produk...
          </button>
        )}
      </FormField>

      {selectedProduct && uoms.length > 0 && (
        <FormField label="Satuan Pembelian" required>
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={selectedUomId}
              onChange={(e) => onSelectedUomIdChange(e.target.value)}
            >
              {uoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.metric_units?.unit_name}{' '}
                  {u.is_default_purchase_unit ? '(Default Beli)' : ''}{' '}
                  {u.is_base_unit ? '(Satuan Base)' : ''}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}
    </div>
  )
}
