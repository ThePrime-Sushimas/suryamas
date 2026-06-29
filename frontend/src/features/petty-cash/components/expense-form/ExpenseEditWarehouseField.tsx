import type { Dispatch, SetStateAction } from 'react'
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
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Gudang</label>
      <select value={form.warehouse_id} onChange={(e) => setForm(f => ({ ...f, warehouse_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
        <option value="">Pilih gudang</option>
        {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
      </select>
    </div>
  )
}
