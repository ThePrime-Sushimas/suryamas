import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { useAuthStore } from '@/features/auth'
import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.6, delay: 0.3 },
}

interface BranchSelectionGuardProps {
  children: React.ReactNode
}

export const BranchSelectionGuard = ({ children }: BranchSelectionGuardProps) => {
  const { token } = useAuthStore()
  const { currentBranch, branches, switchBranch, isLoading, isLoaded, error, refetchBranches } = useBranchContextStore()

  useEffect(() => {
    if (!token || isLoaded) return
    refetchBranches()
  }, [token, isLoaded, refetchBranches])

  // Auto-select when only 1 branch
  useEffect(() => {
    if (isLoaded && branches.length === 1 && !currentBranch) {
      switchBranch(branches[0].branch_id)
    }
  }, [isLoaded, branches, currentBranch, switchBranch])

  const handleRetry = () => {
    refetchBranches()
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return (
      <motion.div className="flex items-center justify-center min-h-screen" {...fadeIn}>
        <div role="status" aria-live="polite" className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" aria-label="Loading" />
          <p className="mt-4 text-gray-700 dark:text-gray-300">Memuat data cabang...</p>
        </div>
      </motion.div>
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
        <motion.div className="flex items-center justify-center min-h-screen" {...fadeIn}>
          <div role="status" aria-live="polite" className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" aria-label="Loading" />
            <p className="mt-4 text-gray-700 dark:text-gray-300">Menyiapkan cabang...</p>
          </div>
        </motion.div>
      )
    }
    
    return (
      <motion.div className="flex items-center justify-center min-h-screen p-4" {...fadeIn}>
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Pilih Cabang</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Anda memiliki akses ke beberapa cabang. Silakan pilih untuk melanjutkan.</p>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {branches.map((branch) => (
              <button
                key={branch.branch_id}
                onClick={() => switchBranch(branch.branch_id)}
                className="p-4 text-left border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {branch.branch_name}
                  {branch.branch_status === 'closed' && (
                    <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">[Tutup]</span>
                  )}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Approval Limit: {branch.approval_limit.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  return <>{children}</>
}
