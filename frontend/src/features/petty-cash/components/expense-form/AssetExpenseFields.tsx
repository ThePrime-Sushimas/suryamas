import { X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
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
    <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Produk Aset *</label>
          {selectedAssetProduct ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <div>
                <span className="text-gray-900 dark:text-white font-medium">{selectedAssetProduct.product_name}</span>
                <span className="ml-2 text-xs text-gray-500 font-mono">{selectedAssetProduct.product_code}</span>
              </div>
              <button type="button" onClick={onClearSelectedAssetProduct}>
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={onOpenAssetProductPicker} className="w-full px-3 py-2.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              Klik untuk cari produk aset...
            </button>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Kategori Pengeluaran *</label>
          <select
            value={expenseForm.category_id}
            disabled
            className="w-full px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
          >
            <option value="">—</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.category_code} — {c.category_name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Kategori Aset (Fixed Asset) *</label>
          <select
            value={expenseForm.asset_category_id}
            disabled
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
          >
            <option value="">—</option>
            {assetCategories.map(ac => <option key={ac.id} value={ac.id}>{ac.category_code} — {ac.category_name} ({ac.tracking_method})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">COA Aset (otomatis)</label>
          <div className="px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-600 dark:text-gray-400">
            {selectedAssetCategory?.asset_coa_code && selectedAssetCategory?.asset_coa_name
              ? `${selectedAssetCategory.asset_coa_code} — ${selectedAssetCategory.asset_coa_name}`
              : '—'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Masa Manfaat (Bulan)</label>
            <input type="number" value={expenseForm.useful_life_months} onChange={(e) => setExpenseForm(f => ({ ...f, useful_life_months: e.target.value }))} placeholder={selectedAssetCategory ? String(selectedAssetCategory.default_useful_life_months) : 'Default kat.'} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nilai Residu (IDR)</label>
            <input type="number" value={expenseForm.salvage_value} onChange={(e) => setExpenseForm(f => ({ ...f, salvage_value: e.target.value }))} placeholder="0" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
        </div>
    </div>
  )
}
