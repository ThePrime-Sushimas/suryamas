import { useEffect, useState } from 'react'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { branchApi } from '@/features/branch_context/api/branchContext.api'

interface PermissionProviderProps {
  children: React.ReactNode
}

export const PermissionProvider = ({ children }: PermissionProviderProps) => {
  const { currentBranch } = useBranchContextStore()
  const { setPermissions, setLoading, setError, clear, error } = usePermissionStore()
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!currentBranch?.role_id) {
      clear()
      return
    }

    const controller = new AbortController()
    let isCurrentRequest = true
    
    const loadPermissions = async () => {
      setLoading(true)
      try {
        const perms = await branchApi.getPermissions(currentBranch.role_id, controller.signal)
        
        if (isCurrentRequest) {
          setPermissions(perms)
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError' && isCurrentRequest) {
          setError(error.message || 'Failed to load permissions')
        }
      } finally {
        if (isCurrentRequest) {
          setLoading(false)
        }
      }
    }

    loadPermissions()
    
    return () => {
      controller.abort()
      isCurrentRequest = false
    }
  }, [clear, currentBranch?.role_id, retryCount, setError, setLoading, setPermissions])
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2">
            Permission Loading Failed
          </h3>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={() => {
              clear()
              setRetryCount(c => c + 1)
            }}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
