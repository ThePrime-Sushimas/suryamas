import type { Dispatch, SetStateAction } from 'react'
import { FormField, Select } from '@/components/ui'
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
      <FormField label="Kategori" required>
        {({ inputId, describedBy }) => (
          <Select
            id={inputId}
            aria-describedby={describedBy}
            value={form.category_id}
            onChange={(e) =>
              setForm((f) => ({
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

      {form.category_id && (
        <FormField label="Sub-kategori">
          {({ inputId, describedBy }) => (
            <Select
              id={inputId}
              aria-describedby={describedBy}
              value={form.sub_category_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, sub_category_id: e.target.value }))
              }
            >
              <option value="">—</option>
              {subCategories.length > 0 ? (
                subCategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.sub_category_name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  Memuat...
                </option>
              )}
            </Select>
          )}
        </FormField>
      )}
    </div>
  )
}
