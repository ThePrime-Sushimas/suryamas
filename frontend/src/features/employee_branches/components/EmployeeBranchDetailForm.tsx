import { useState, useEffect } from 'react'
import type { EmployeeBranch, CreateEmployeeBranchDTO, UpdateEmployeeBranchDTO, Role, BranchOption, BranchAssignmentStatus } from '../api/types'

interface Props {
  employeeId: string
  assignment?: EmployeeBranch
  assignedBranchIds: string[]
  roles: Role[]
  branches: BranchOption[]
  onSubmit: (data: CreateEmployeeBranchDTO | UpdateEmployeeBranchDTO) => Promise<void>
  onCancel: () => void
  hasPrimaryBranch: boolean
}

export const EmployeeBranchDetailForm = ({ employeeId, assignment, assignedBranchIds, roles, branches, onSubmit, onCancel, hasPrimaryBranch }: Props) => {
  const [branchId, setBranchId] = useState(assignment?.branch_id || '')
  const [roleId, setRoleId] = useState(assignment?.role_id || '')
  const [approvalLimit, setApprovalLimit] = useState(assignment?.approval_limit.toString() || '0')
  const [isPrimary, setIsPrimary] = useState(assignment?.is_primary || false)
  const [status, setStatus] = useState<BranchAssignmentStatus>(assignment?.status || 'active')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const availableBranches = branches.filter((b) => !assignedBranchIds.includes(b.id) || b.id === assignment?.branch_id)

  useEffect(() => {
    if (isPrimary && status === 'suspended') {
      setErrors((prev) => ({ ...prev, status: 'Cannot suspend primary branch' }))
    } else {
      setErrors((prev) => {
        const { status, ...rest } = prev
        return rest
      })
    }
  }, [isPrimary, status])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!assignment && !branchId) newErrors.branchId = 'Branch is required'
    if (!roleId) newErrors.roleId = 'Role is required'
    if (Number(approvalLimit) < 0) newErrors.approvalLimit = 'Approval limit must be >= 0'
    if (isPrimary && hasPrimaryBranch && !assignment?.is_primary) newErrors.isPrimary = 'Only one primary branch allowed'
    if (isPrimary && status === 'suspended') newErrors.status = 'Cannot suspend primary branch'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      if (assignment) {
        await onSubmit({ role_id: roleId, approval_limit: Number(approvalLimit), is_primary: isPrimary, status })
      } else {
        await onSubmit({ employee_id: employeeId, branch_id: branchId, role_id: roleId, approval_limit: Number(approvalLimit), is_primary: isPrimary, status })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!assignment && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={submitting}>
            <option value="">Select branch</option>
            {availableBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.branch_name} ({branch.branch_code})</option>
            ))}
          </select>
          {errors.branchId && <p className="mt-1 text-sm text-red-600">{errors.branchId}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={submitting}>
          <option value="">Select role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        {errors.roleId && <p className="mt-1 text-sm text-red-600">{errors.roleId}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Approval Limit (IDR) <span className="text-red-500">*</span></label>
        <input type="number" value={approvalLimit} onChange={(e) => setApprovalLimit(e.target.value)} min="0" step="1000" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={submitting} />
        {errors.approvalLimit && <p className="mt-1 text-sm text-red-600">{errors.approvalLimit}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as BranchAssignmentStatus)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={submitting}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
        {errors.status && <p className="mt-1 text-sm text-red-600">{errors.status}</p>}
      </div>

      <div className="flex items-center">
        <input type="checkbox" id="isPrimary" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" disabled={submitting} />
        <label htmlFor="isPrimary" className="ml-2 block text-sm text-gray-900">Set as primary branch</label>
      </div>
      {errors.isPrimary && <p className="text-sm text-red-600">{errors.isPrimary}</p>}

      {isPrimary && hasPrimaryBranch && !assignment?.is_primary && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">⚠️ Setting this as primary will remove the primary status from the current primary branch.</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={submitting}>Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={submitting}>
          {submitting ? 'Saving...' : assignment ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}
