import type { ProductUom } from '@/features/product-uoms/types'

export interface ExpenseEditProductSectionProps {
  productName: string
  uoms: ProductUom[]
  selectedUomId: string
  onSelectedUomIdChange: (uomId: string) => void
}

export function ExpenseEditProductSection({
  productName,
  uoms,
  selectedUomId,
  onSelectedUomIdChange,
}: ExpenseEditProductSectionProps) {
  return (
    <div className="space-y-3">
      <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/30 text-sm">
        <span className="text-xs text-gray-500">Produk:</span>
        <span className="ml-2 font-medium text-gray-900 dark:text-white">{productName}</span>
      </div>
      {uoms.length > 0 && (
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
