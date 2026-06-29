import { X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { FormField, Select, Input, CurrencyInput } from '@/components/ui'
import type { Category } from '@/features/categories/types'
import type { AssetCategory } from '@/features/fixed-assets/api/fixed-assets.api'
import type {
  ExpenseFormState,
  SelectedAssetExpenseProduct,
} from '../../hooks/useExpenseFormModal'

export interface AssetExpenseFieldsProps {
  expenseForm: ExpenseFormState
  setExpenseForm: Dispatch<SetStateAction<ExpenseFormState>>
  categories: Category[]
  assetCategories: AssetCategory[]
  selectedAssetProduct: SelectedAssetExpenseProduct | null
  selectedAssetCategory: AssetCategory | undefined
  onOpenAssetProductPicker: () => void
  onClearSelectedAssetProduct: () => void
}

export function AssetExpenseFields({
  expenseForm,
  setExpenseForm,
  categories,
  assetCategories,
  selectedAssetProduct,
  selectedAssetCategory,
  onOpenAssetProductPicker,
  onClearSelectedAssetProduct,
}: AssetExpenseFieldsProps) {
  return (
    <div className="space-y-4">
      <FormField label="Produk Aset" required>
        {selectedAssetProduct ? (
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            <div>
              <span className="font-medium text-gray-900 dark:text-white">
                {selectedAssetProduct.product_name}
              </span>
              <span className="ml-2 font-mono text-xs text-gray-500">
                {selectedAssetProduct.product_code}
              </span>
            </div>
            <button type="button" onClick={onClearSelectedAssetProduct}>
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAssetProductPicker}
            className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-600"
          >
            Klik untuk cari produk aset...
          </button>
        )}
      </FormField>

      <FormField label="Kategori Pengeluaran" required>
        {({ inputId, describedBy }) => (
          <Select
            id={inputId}
            aria-describedby={describedBy}
            value={expenseForm.category_id}
            disabled
            className="cursor-not-allowed bg-gray-50 text-gray-500 dark:bg-gray-900/50 dark:text-gray-400"
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category_code} — {c.category_name}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField label="Kategori Aset (Fixed Asset)" required>
        {({ inputId, describedBy }) => (
          <Select
            id={inputId}
            aria-describedby={describedBy}
            value={expenseForm.asset_category_id}
            disabled
            className="cursor-not-allowed bg-gray-50 text-gray-500 dark:bg-gray-900/50 dark:text-gray-400"
          >
            <option value="">—</option>
            {assetCategories.map((ac) => (
              <option key={ac.id} value={ac.id}>
                {ac.category_code} — {ac.category_name} ({ac.tracking_method})
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField label="COA Aset (otomatis)">
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
          {selectedAssetCategory?.asset_coa_code && selectedAssetCategory?.asset_coa_name
            ? `${selectedAssetCategory.asset_coa_code} — ${selectedAssetCategory.asset_coa_name}`
            : '—'}
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Masa Manfaat (Bulan)">
          {({ inputId, describedBy }) => (
            <Input
              id={inputId}
              aria-describedby={describedBy}
              type="number"
              value={expenseForm.useful_life_months}
              onChange={(e) =>
                setExpenseForm((f) => ({ ...f, useful_life_months: e.target.value }))
              }
              placeholder={
                selectedAssetCategory
                  ? String(selectedAssetCategory.default_useful_life_months)
                  : 'Default kat.'
              }
              min="0"
            />
          )}
        </FormField>

        <FormField label="Nilai Residu (IDR)">
          {({ inputId, describedBy }) => (
            <CurrencyInput
              id={inputId}
              aria-describedby={describedBy}
              value={expenseForm.salvage_value}
              onChange={(value) =>
                setExpenseForm((f) => ({ ...f, salvage_value: value }))
              }
            />
          )}
        </FormField>
      </div>
    </div>
  )
}
