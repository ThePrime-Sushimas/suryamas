import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { branchApi } from '@/features/branch_context/api/branchContext.api'
import { useAuthStore } from '@/features/auth'
import { useEffect, useState } from 'react'

interface BranchSelectionGuardProps {
  children: React.ReactNode
}

export const BranchSelectionGuard = ({ children }: BranchSelectionGuardProps) => {
  const { token } = useAuthStore()
  const { currentBranch, branches, setBranches, switchBranch, isLoading, error, setLoading, setError } = useBranchContextStore()
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    
    const loadBranches = async () => {
      setLoading(true)
      try {
        const userBranches = await branchApi.getUserBranches(controller.signal)
        
        if (userBranches.length === 0) {
          setError('No branch assignments found')
          return
        }

        setBranches(userBranches)
        
        // Auto-switch hanya saat initial load dan ada 1 branch
        if (initialLoad && userBranches.length === 1) {
          switchBranch(userBranches[0].branch_id)
        }
        
        setInitialLoad(false)
      } catch (err: unknown) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load branches')
        }
      } finally {
        setLoading(false)
      }
    }

    loadBranches()
    return () => controller.abort()
  }, [token])

  const handleRetry = () => {
    setError(null)
    setInitialLoad(true)
  }

  if (!token) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div role="status" aria-live="polite" className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" aria-label="Loading" />
          <p className="mt-4 text-gray-700 dark:text-gray-300">Loading branch context...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4" role="alert">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Branch Access Error</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (branches.length > 0 && !currentBranch) {
    if (branches.length === 1) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div role="status" aria-live="polite" className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" aria-label="Loading" />
            <p className="mt-4 text-gray-700 dark:text-gray-300">Setting up branch...</p>
          </div>
        </div>
      )
    }
    
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Select Branch</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">You have access to multiple branches. Please select one to continue.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {branches.map((branch) => (
              <button
                key={branch.branch_id}
                onClick={() => switchBranch(branch.branch_id)}
                className="p-4 text-left border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{branch.branch_name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Approval Limit: {branch.approval_limit.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
