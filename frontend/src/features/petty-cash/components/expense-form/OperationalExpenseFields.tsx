import type { Dispatch, SetStateAction } from 'react'
import { FormField, Select } from '@/components/ui'
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
    <div className="space-y-4">
      <FormField label="Kategori Pengeluaran" required>
        {({ inputId, describedBy }) => (
          <Select
            id={inputId}
            aria-describedby={describedBy}
            value={expenseForm.category_id}
            onChange={(e) =>
              setExpenseForm((f) => ({
                ...f,
                category_id: e.target.value,
                sub_category_id: '',
              }))
            }
          >
            <option value="">Pilih kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category_code} — {c.category_name}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      {expenseForm.category_id && subCategories.length > 0 && (
        <FormField label="Sub-kategori">
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={expenseForm.sub_category_id}
              onChange={(e) =>
                setExpenseForm((f) => ({ ...f, sub_category_id: e.target.value }))
              }
            >
              <option value="">—</option>
              {subCategories.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.sub_category_name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}
    </div>
  )
}
