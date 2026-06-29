import type { Dispatch, SetStateAction } from 'react'
import { FormField, Select } from '@/components/ui'
import type { Warehouse } from '@/features/inventory/types'
import type { ExpenseEditFormState } from '../../hooks/useExpenseEditForm'

export interface ExpenseEditWarehouseFieldProps {
  form: ExpenseEditFormState
  setForm: Dispatch<SetStateAction<ExpenseEditFormState>>
  warehouses: Warehouse[]
}

export function ExpenseEditWarehouseField({
  form,
  setForm,
  warehouses,
}: ExpenseEditWarehouseFieldProps) {
  return (
    <FormField label="Gudang">
      {({ inputId, describedBy }) => (
        <Select
          id={inputId}
          aria-describedby={describedBy}
          value={form.warehouse_id}
          onChange={(e) =>
            setForm((f) => ({ ...f, warehouse_id: e.target.value }))
          }
        >
          <option value="">Pilih gudang</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.warehouse_name}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  )
}
