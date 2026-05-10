import { useState, useEffect } from 'react'
import { usePositions } from '@/features/settings/api/settings.api'
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

const inputCls = "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
const labelCls = "block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide"

export const EmployeeBranchDetailForm = ({ employeeId, assignment, assignedBranchIds, roles, branches, onSubmit, onCancel, hasPrimaryBranch }: Props) => {
  const [branchId, setBranchId] = useState(assignment?.branch_id || '')
  const [roleId, setRoleId] = useState(assignment?.role_id || '')
  const [positionId, setPositionId] = useState<string>(assignment?.position_id || '')
  const [approvalLimit, setApprovalLimit] = useState(assignment?.approval_limit.toString() || '0')
  const [isPrimary, setIsPrimary] = useState(assignment?.is_primary || false)
  const [status, setStatus] = useState<BranchAssignmentStatus>(assignment?.status || 'active')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const positions = usePositions()
  const availableBranches = branches.filter((b) => !assignedBranchIds.includes(b.id) || b.id === assignment?.branch_id)

  useEffect(() => {
    if (isPrimary && status === 'suspended') {
      setErrors((prev) => ({ ...prev, status: 'Cannot suspend primary branch' }))
    } else {
      setErrors((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { status: statusError, ...rest } = prev
        return rest
      })
    }
  }, [isPrimary, status])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!assignment && !branchId) newErrors.branchId = 'Branch is required'
    if (!roleId) newErrors.roleId = 'Role is required'
    if (Number(approvalLimit) < 0) newErrors.approvalLimit = 'Approval limit must be >= 0'
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
        await onSubmit({ 
          role_id: roleId, 
          position_id: positionId || null,
          approval_limit: Number(approvalLimit), 
          is_primary: isPrimary, 
          status 
        })
      } else {
        await onSubmit({ 
          employee_id: employeeId, 
          branch_id: branchId, 
          role_id: roleId, 
          position_id: positionId || null,
          approval_limit: Number(approvalLimit), 
          is_primary: isPrimary, 
          status 
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!assignment && (
        <div>
          <label className={labelCls}>Branch <span className="text-red-500">*</span></label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls} disabled={submitting}>
            <option value="">Pilih cabang...</option>
            {availableBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.branch_name} ({branch.branch_code})</option>
            ))}
          </select>
          {errors.branchId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.branchId}</p>}
        </div>
      )}

      <div>
        <label className={labelCls}>Position</label>
        <select 
          value={positionId} 
          onChange={(e) => setPositionId(e.target.value)} 
          className={inputCls} 
          disabled={submitting || positions.isLoading}
        >
          <option value="">Tidak ada posisi (Optional)</option>
          {(positions.data || []).map((pos) => (
            <option key={pos.id} value={pos.id}>
              {pos.position_name} ({pos.department_name})
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">Posisi operasional di cabang ini</p>
      </div>

      <div>
        <label className={labelCls}>Role <span className="text-red-500">*</span></label>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputCls} disabled={submitting}>
          <option value="">Pilih role...</option>
          {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
        {errors.roleId && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.roleId}</p>}
      </div>

      <div>
        <label className={labelCls}>Approval Limit (IDR) <span className="text-red-500">*</span></label>
        <input 
          type="number" 
          value={approvalLimit} 
          onChange={(e) => setApprovalLimit(e.target.value)} 
          min="0" 
          step="1000" 
          className={inputCls} 
          disabled={submitting} 
          placeholder="0"
        />
        {errors.approvalLimit && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.approvalLimit}</p>}
      </div>

      <div>
        <label className={labelCls}>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as BranchAssignmentStatus)} className={inputCls} disabled={submitting}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
        {errors.status && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.status}</p>}
      </div>

      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <input 
          type="checkbox" 
          id="isPrimary" 
          checked={isPrimary} 
          onChange={(e) => setIsPrimary(e.target.checked)} 
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" 
          disabled={submitting} 
        />
        <label htmlFor="isPrimary" className="text-sm font-medium text-gray-900 dark:text-gray-200">Set as primary branch</label>
      </div>

      {isPrimary && hasPrimaryBranch && !assignment?.is_primary && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs text-amber-800 dark:text-amber-400">⚠️ Setting this as primary will remove the primary status from the current primary branch.</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button 
          type="button" 
          onClick={onCancel} 
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors" 
          disabled={submitting}
        >
          Batal
        </button>
        <button 
          type="submit" 
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors" 
          disabled={submitting}
        >
          {submitting ? 'Menyimpan...' : assignment ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}
