import { FormField, Select } from '@/components/ui'
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
    <div className="space-y-4">
      <FormField label="Produk">
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700/30">
          <span className="font-medium text-gray-900 dark:text-white">{productName}</span>
        </div>
      </FormField>

      {uoms.length > 0 && (
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
