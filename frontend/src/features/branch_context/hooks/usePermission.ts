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
      if (currentBranch) {
        setLoading(true)
        try {
          const perms = await branchApi.getPermissions(currentBranch.role_id)
          setPermissions(perms)
        } catch (error: any) {
          setError(error.message || 'Failed to load permissions')
          setPermissions({})
        }
      }
    }

    if (!isLoaded || currentBranch?.role_id) {
      loadPermissions()
    }
  }, [currentBranch?.role_id, setPermissions, setLoading, setError])

  return hasPermission(module, action)
}
