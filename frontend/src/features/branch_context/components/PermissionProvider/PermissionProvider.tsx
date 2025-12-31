import { useEffect } from 'react'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { branchApi } from '@/features/branch_context/api/branchContext.api'

interface PermissionProviderProps {
  children: React.ReactNode
}

export const PermissionProvider = ({ children }: PermissionProviderProps) => {
  const { currentBranch } = useBranchContextStore()
  const { setPermissions, setLoading, setError, clear } = usePermissionStore()

  useEffect(() => {
    if (!currentBranch?.role_id) {
      clear()
      return
    }

    const controller = new AbortController()
    
    const loadPermissions = async () => {
      setLoading(true)
      try {
        const perms = await branchApi.getPermissions(currentBranch.role_id, controller.signal)
        setPermissions(perms)
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          setError(error.message || 'Failed to load permissions')
        }
      }
    }

    loadPermissions()
    return () => controller.abort()
  }, [currentBranch?.role_id, setPermissions, setLoading, setError, clear])

  return <>{children}</>
}
