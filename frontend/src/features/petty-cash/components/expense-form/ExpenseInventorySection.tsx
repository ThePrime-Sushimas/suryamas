import type { Dispatch, SetStateAction } from 'react'
import { FormField, Select } from '@/components/ui'
import type { Warehouse } from '@/features/inventory/types'
import type { ExpenseFormState } from '../../hooks/useExpenseFormModal'

export interface ExpenseInventorySectionProps {
  expenseForm: ExpenseFormState
  setExpenseForm: Dispatch<SetStateAction<ExpenseFormState>>
  trackInventory: boolean
  onTrackInventoryChange: (checked: boolean) => void
  warehouses: Warehouse[]
}

export function ExpenseInventorySection({
  expenseForm,
  setExpenseForm,
  trackInventory,
  onTrackInventoryChange,
  warehouses,
}: ExpenseInventorySectionProps) {
  return (
    <div className="space-y-3 pt-1">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={trackInventory}
          onChange={(e) => onTrackInventoryChange(e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Masukkan ke gudang (inventory)
        </span>
      </label>

      {trackInventory && (
        <div className="border-l-2 border-blue-300 pl-3">
          <FormField label="Gudang" required>
            {({ inputId, describedBy }) => (
              <Select
                id={inputId}
                aria-describedby={describedBy}
                value={expenseForm.warehouse_id}
                onChange={(e) =>
                  setExpenseForm((f) => ({ ...f, warehouse_id: e.target.value }))
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
        </div>
      )}
    </div>
  )
}
