import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useToast } from '@/contexts/ToastContext'

export const BranchSwitcher = () => {
  const { currentBranch, branches, switchBranchWithPermissions, refetchBranches, isLoading } = useBranchContextStore()
  const { success, error: showError } = useToast()

  if (branches.length === 0) return null

  const handleSwitch = async (branchId: string) => {
    if (branchId === currentBranch?.branch_id || isLoading) return

    const result = await switchBranchWithPermissions(branchId)
    
    if (result.success) {
      success('Branch switched successfully')
    } else {
      showError(result.error || 'Failed to switch branch')
    }
  }
  
  const handleRefresh = async () => {
    await refetchBranches()
    success('Branches refreshed')
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentBranch?.branch_id || ''}
        onChange={(e) => handleSwitch(e.target.value)}
        disabled={branches.length <= 1 || isLoading || !currentBranch}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {branches.map((branch) => (
          <option key={branch.branch_id} value={branch.branch_id}>
            {branch.branch_name}
          </option>
        ))}
      </select>
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
        title="Refresh branches"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
      {currentBranch && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Role: {currentBranch.role_name}
        </span>
      )}
    </div>
  )
}
