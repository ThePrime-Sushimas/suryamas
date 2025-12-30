import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { branchApi } from '@/features/branch_context/api/branchContext.api'
import { useState } from 'react'

export const BranchSwitcher = () => {
  const { currentBranch, branches, switchBranch } = useBranchContextStore()
  const [isLoading, setIsLoading] = useState(false)

  if (branches.length === 0) return null

  const handleSwitch = async (branchId: string) => {
    if (branchId === currentBranch?.branch_id) return

    setIsLoading(true)
    try {
      // Switch branch
      switchBranch(branchId)

      // Reload permissions
      await branchApi.getPermissions()

      // Force page reload to refetch data
      window.location.reload()
    } catch (error) {
      console.error('Branch switch failed:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentBranch?.branch_id || ''}
        onChange={(e) => handleSwitch(e.target.value)}
        disabled={isLoading || branches.length <= 1}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {branches.map((branch, index) => (
          <option key={`${branch.branch_id}-${index}`} value={branch.branch_id}>
            {branch.branch_name}
          </option>
        ))}
      </select>
      {isLoading && <span className="text-xs text-gray-500">Switching...</span>}
    </div>
  )
}
