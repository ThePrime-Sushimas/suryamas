import { useCallback } from 'react'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import type { PermissionAction } from '@/features/branch_context/types'

export const usePermission = (module: string, action: PermissionAction) => {
  const hasPermission = usePermissionStore(
    useCallback((state) => state.hasPermission(module, action), [module, action])
  )
  const isLoading = usePermissionStore((state) => state.isLoading)
  const isLoaded = usePermissionStore((state) => state.isLoaded)
  const error = usePermissionStore((state) => state.error)
  
  return { hasPermission, isLoading, isLoaded, error }
}
