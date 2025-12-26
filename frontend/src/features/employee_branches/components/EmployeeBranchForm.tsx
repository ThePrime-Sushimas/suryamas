import { useState } from 'react'
import type { CreateEmployeeBranchDTO, UpdateEmployeeBranchDTO, EmployeeBranch } from '../api/types'

type Props = {
  mode: 'create' | 'edit'
  initial?: EmployeeBranch | null
  employees: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  loading: boolean
  onSubmit: (payload: CreateEmployeeBranchDTO | UpdateEmployeeBranchDTO) => void
  onCancel: () => void
}

export function EmployeeBranchForm({ mode, initial, employees, branches, loading, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState({
    employee_id: initial?.employee_id || '',
    branch_id: initial?.branch_id || '',
    is_primary: initial?.is_primary || false,
  })

  const handleSubmit = () => {
    if (mode === 'create') {
      onSubmit({ employee_id: form.employee_id, branch_id: form.branch_id, is_primary: form.is_primary })
    } else {
      onSubmit({ is_primary: form.is_primary })
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
          <select
            className="w-full px-3 py-2 border rounded-lg"
            value={form.employee_id}
            onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
            disabled={mode === 'edit' || loading}
          >
            <option value="">-- Pilih Employee --</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <select
            className="w-full px-3 py-2 border rounded-lg"
            value={form.branch_id}
            onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
            disabled={mode === 'edit' || loading}
          >
            <option value="">-- Pilih Branch --</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_primary"
            checked={form.is_primary}
            onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))}
            className="mr-2"
          />
          <label htmlFor="is_primary" className="text-sm text-gray-700">Set as Primary Branch</label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button className="px-4 py-2 rounded border" onClick={onCancel} disabled={loading}>Batal</button>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={loading || !form.employee_id || !form.branch_id}
        >
          {mode === 'create' ? 'Simpan' : 'Update'}
        </button>
      </div>
    </div>
  )
}
