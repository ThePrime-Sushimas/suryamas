import type { Dispatch, SetStateAction } from 'react'
import type { Category, SubCategory } from '@/features/categories/types'
import type { ExpenseEditFormState } from '../../hooks/useExpenseEditForm'

export interface ExpenseEditCategoryFieldsProps {
  form: ExpenseEditFormState
  setForm: Dispatch<SetStateAction<ExpenseEditFormState>>
  categories: Category[]
  subCategories: SubCategory[]
}

export function ExpenseEditCategoryFields({
  form,
  setForm,
  categories,
  subCategories,
}: ExpenseEditCategoryFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Kategori *</label>
        <select value={form.category_id} onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value, sub_category_id: '' }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
          <option value="">Pilih kategori</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.category_code} — {c.category_name}</option>)}
        </select>
      </div>
      {form.category_id && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sub-kategori</label>
          <select value={form.sub_category_id} onChange={(e) => setForm(f => ({ ...f, sub_category_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
            <option value="">—</option>
            {subCategories.length > 0 ? (
              subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.sub_category_name}</option>)
            ) : (
              <option value="" disabled>Memuat...</option>
            )}
          </select>
        </div>
      )}
    </div>
  )
}
