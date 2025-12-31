import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import type { PermissionAction } from '@/features/branch_context/types'

export const usePermission = (module: string, action: PermissionAction) => {
  const { hasPermission, isLoaded, isLoading } = usePermissionStore()
  
  return {
    hasPermission: hasPermission(module, action),
    isLoading,
    isLoaded,
  }
}
