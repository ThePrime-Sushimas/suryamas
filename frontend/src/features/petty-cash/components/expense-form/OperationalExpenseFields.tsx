import type { Dispatch, SetStateAction } from 'react'
import type { Category, SubCategory } from '@/features/categories/types'
import type { ExpenseFormState } from '../../hooks/useExpenseFormModal'

export interface OperationalExpenseFieldsProps {
  expenseForm: ExpenseFormState
  setExpenseForm: Dispatch<SetStateAction<ExpenseFormState>>
  categories: Category[]
  subCategories: SubCategory[]
}

export function OperationalExpenseFields({
  expenseForm,
  setExpenseForm,
  categories,
  subCategories,
}: OperationalExpenseFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Kategori Pengeluaran *</label>
        <select value={expenseForm.category_id} onChange={(e) => setExpenseForm(f => ({ ...f, category_id: e.target.value, sub_category_id: '' }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
          <option value="">Pilih kategori</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.category_code} — {c.category_name}</option>)}
        </select>
      </div>
      {expenseForm.category_id && subCategories.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sub-kategori</label>
          <select value={expenseForm.sub_category_id} onChange={(e) => setExpenseForm(f => ({ ...f, sub_category_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
            <option value="">—</option>
            {subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.sub_category_name}</option>)}
          </select>
        </div>
      )}
    </>
  )
}
