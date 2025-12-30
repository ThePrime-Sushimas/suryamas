import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { branchApi } from '@/features/branch_context/api/branchContext.api'
import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

export const BranchSwitcher = () => {
  const { currentBranch, branches, switchBranch, setBranches, setLoading, setError } = useBranchContextStore()
  const { setPermissions, clear: clearPermissions } = usePermissionStore()
  const { success, error: showError } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshBranches = async () => {
    setIsRefreshing(true)
    try {
      const data = await branchApi.getUserBranches()
      setBranches(data)
    } catch (error: any) {
      showError(error.message || 'Failed to refresh branches')
      setError(error.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    refreshBranches()
  }, [])

  if (branches.length === 0) return null

  const handleSwitch = async (branchId: string) => {
    if (branchId === currentBranch?.branch_id) return

    setLoading(true)
    try {
      switchBranch(branchId)
      clearPermissions()
      await branchApi.getPermissions().then(setPermissions)
      success('Branch switched successfully')
    } catch (error: any) {
      showError(error.message || 'Failed to switch branch')
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentBranch?.branch_id || ''}
        onChange={(e) => handleSwitch(e.target.value)}
        disabled={branches.length <= 1}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {branches.map((branch) => (
          <option key={branch.branch_id} value={branch.branch_id}>
            {branch.branch_name}
          </option>
        ))}
      </select>
      <button
        onClick={refreshBranches}
        disabled={isRefreshing}
        className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50"
        title="Refresh branches"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}
