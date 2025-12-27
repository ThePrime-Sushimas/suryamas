import { useState, useEffect } from 'react'
import type { CreateEmployeeBranchDTO, UpdateEmployeeBranchDTO, EmployeeBranch } from '../api/types'

type CreateProps = {
  mode: 'create'
  initial?: never
  employees: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  loading: boolean
  onSubmit: (payload: CreateEmployeeBranchDTO) => void
  onCancel: () => void
}

type EditProps = {
  mode: 'edit'
  initial: EmployeeBranch
  employees: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  loading: boolean
  onSubmit: (payload: UpdateEmployeeBranchDTO) => void
  onCancel: () => void
}

type Props = CreateProps | EditProps

type FormState = {
  employee_id: string
  branch_id: string
  is_primary: boolean
}

export function EmployeeBranchForm(props: Props) {
  const { mode, employees, branches, loading, onSubmit, onCancel } = props

  const getInitialState = (): FormState => {
    if (mode === 'edit') {
      return {
        employee_id: props.initial.employee_id,
        branch_id: props.initial.branch_id,
        is_primary: props.initial.is_primary,
      }
    }
    return { employee_id: '', branch_id: '', is_primary: false }
  }

  const [form, setForm] = useState<FormState>(getInitialState)
  const [isDirty, setIsDirty] = useState(false)

  // Fix: Sync state when initial changes (edit mode)
  useEffect(() => {
    if (mode === 'edit') {
      setForm({
        employee_id: props.initial.employee_id,
        branch_id: props.initial.branch_id,
        is_primary: props.initial.is_primary,
      })
      setIsDirty(false)
    }
  }, [mode, props.mode === 'edit' ? props.initial.id : null])

  const handleFieldChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  const isFormValid = (): boolean => {
    if (mode === 'create') {
      return form.employee_id.trim() !== '' && form.branch_id.trim() !== ''
    }
    // Edit mode: always valid (only updating is_primary)
    return true
  }

  const canSubmit = (): boolean => {
    if (loading) return false
    if (!isFormValid()) return false
    if (mode === 'edit' && !isDirty) return false
    return true
  }

  const handleSubmit = () => {
    if (!canSubmit()) return

    if (mode === 'create') {
      onSubmit({
        employee_id: form.employee_id,
        branch_id: form.branch_id,
        is_primary: form.is_primary,
      })
    } else {
      onSubmit({ is_primary: form.is_primary })
    }
  }

  const handleCancel = () => {
    if (isDirty && !loading) {
      if (!confirm('Ada perubahan yang belum disimpan. Yakin ingin membatalkan?')) {
        return
      }
    }
    onCancel()
  }

  const isFieldDisabled = mode === 'edit' || loading

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Employee {mode === 'create' && <span className="text-red-500">*</span>}
          </label>
          <select
            className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={form.employee_id}
            onChange={e => handleFieldChange('employee_id', e.target.value)}
            disabled={isFieldDisabled}
            aria-required={mode === 'create'}
          >
            <option value="">-- Pilih Employee --</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Branch {mode === 'create' && <span className="text-red-500">*</span>}
          </label>
          <select
            className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
            value={form.branch_id}
            onChange={e => handleFieldChange('branch_id', e.target.value)}
            disabled={isFieldDisabled}
            aria-required={mode === 'create'}
          >
            <option value="">-- Pilih Branch --</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_primary"
            checked={form.is_primary}
            onChange={e => handleFieldChange('is_primary', e.target.checked)}
            disabled={loading}
            className="mr-2 disabled:cursor-not-allowed"
          />
          <label htmlFor="is_primary" className="text-sm text-gray-700">
            Set as Primary Branch
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="px-4 py-2 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleCancel}
          disabled={loading}
        >
          Batal
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleSubmit}
          disabled={!canSubmit()}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {mode === 'create' ? 'Menyimpan...' : 'Mengupdate...'}
            </span>
          ) : (
            <>{mode === 'create' ? 'Simpan' : 'Update'}</>
          )}
        </button>
      </div>
    </div>
  )
}
