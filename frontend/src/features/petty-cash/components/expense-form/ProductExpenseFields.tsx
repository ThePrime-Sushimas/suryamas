import { X } from 'lucide-react'
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
    <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Produk *</label>
          {selectedProduct ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <div>
                <span className="text-gray-900 dark:text-white font-medium">{selectedProduct.product_name}</span>
                {expenseForm.category_id && <span className="ml-2 text-xs text-gray-500">({categories.find(c => c.id === expenseForm.category_id)?.category_name})</span>}
              </div>
              <button type="button" onClick={onClearSelectedProduct}>
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={onOpenProductPicker} className="w-full px-3 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              Klik untuk cari produk...
            </button>
          )}
        </div>
        {selectedProduct && uoms.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Satuan Pembelian *</label>
            <select value={selectedUomId} onChange={(e) => onSelectedUomIdChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              {uoms.map(u => (
                <option key={u.id} value={u.id}>
                  {u.metric_units?.unit_name} {u.is_default_purchase_unit ? '(Default Beli)' : ''} {u.is_base_unit ? '(Satuan Base)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
    </div>
  )
}
