import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { useEffect } from 'react'
import { branchApi } from '@/features/branch_context/api/branchContext.api'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import type { PermissionAction } from '@/features/branch_context/types'

export const usePermission = (module: string, action: PermissionAction) => {
  const { hasPermission, isLoaded, setPermissions, setLoading, setError } = usePermissionStore()
  const { currentBranch } = useBranchContextStore()

  useEffect(() => {
    const loadPermissions = async () => {
      if (!isLoaded && currentBranch) {
        setLoading(true)
        try {
          const perms = await branchApi.getPermissions()
          setPermissions(perms)
        } catch (error: any) {
          setError(error.message || 'Failed to load permissions')
          setPermissions({})
        }
      }
    }

    loadPermissions()
  }, [isLoaded, currentBranch, setPermissions, setLoading, setError])

  return hasPermission(module, action)
}
