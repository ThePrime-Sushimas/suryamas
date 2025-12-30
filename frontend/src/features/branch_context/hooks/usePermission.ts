import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useEffect } from 'react'
import { branchApi } from '@/features/branch_context/api/branchContext.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

export const usePermission = (module: string, action: 'view' | 'insert' | 'update' | 'delete' | 'approve' | 'release') => {
  const { hasPermission, isLoaded, setPermissions } = usePermissionStore()
  const { currentBranch } = useBranchContextStore()

  useEffect(() => {
    const loadPermissions = async () => {
      if (!isLoaded && currentBranch) {
        try {
          const perms = await branchApi.getPermissions()
          setPermissions(perms)
        } catch (error) {
          // Silently fail - permission endpoint not implemented yet
          setPermissions({})
        }
      }
    }

    loadPermissions()
  }, [isLoaded, currentBranch, setPermissions])

  // Temporary: return true for employee_branches.update
  if (module === 'employee_branches' && action === 'update') {
    return true
  }

  return hasPermission(module, action)
}
