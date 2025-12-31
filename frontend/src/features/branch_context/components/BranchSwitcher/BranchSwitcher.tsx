import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useToast } from '@/contexts/ToastContext'

export const BranchSwitcher = () => {
  const { currentBranch, branches, switchBranch, isLoading } = useBranchContextStore()
  const { clear: clearPermissions } = usePermissionStore()
  const { success, error: showError } = useToast()

  if (branches.length === 0) return null

  const handleSwitch = (branchId: string) => {
    if (branchId === currentBranch?.branch_id || isLoading) return

    const switched = switchBranch(branchId)
    if (!switched) {
      showError('Invalid branch selection')
      return
    }

    clearPermissions()
    success('Branch switched successfully')
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentBranch?.branch_id || ''}
        onChange={(e) => handleSwitch(e.target.value)}
        disabled={branches.length <= 1 || isLoading}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading && <option>Switching branch...</option>}
        {branches.map((branch) => (
          <option key={branch.branch_id} value={branch.branch_id}>
            {branch.branch_name}
          </option>
        ))}
      </select>
      {currentBranch && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Role: {currentBranch.role_id}
        </span>
      )}
    </div>
  )
}
