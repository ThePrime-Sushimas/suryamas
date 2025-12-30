import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { branchApi } from '@/features/branch_context/api/branchContext.api'
import { useEffect, useState } from 'react'

interface BranchSelectionGuardProps {
  children: React.ReactNode
}

export const BranchSelectionGuard = ({ children }: BranchSelectionGuardProps) => {
  const { currentBranch, branches, setBranches, switchBranch } = useBranchContextStore()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const userBranches = await branchApi.getUserBranches()
        
        if (userBranches.length === 0) {
          setError('No branch assignments found')
          return
        }

        setBranches(userBranches)
      } catch (err: any) {
        setError(err.message || 'Failed to load branches')
      } finally {
        setIsLoading(false)
      }
    }

    // Only load if branches not yet loaded
    if (branches.length === 0) {
      loadBranches()
    } else {
      setIsLoading(false)
    }
  }, [branches.length, setBranches])

  if (isLoading) {
    return (
      <div className="branch-loading">
        <div className="spinner" />
        <p>Loading branch context...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="branch-error">
        <h2>Branch Access Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.href = '/login'}>
          Back to Login
        </button>
      </div>
    )
  }

  if (branches.length > 1 && !currentBranch) {
    return (
      <div className="branch-selection">
        <h2>Select Branch</h2>
        <p>You have access to multiple branches. Please select one to continue.</p>
        <div className="branch-list">
          {branches.map((branch) => (
            <button
              key={branch.branch_id}
              onClick={() => switchBranch(branch.branch_id)}
              className="branch-option"
            >
              <h3>{branch.branch_name}</h3>
              <p>Approval Limit: {branch.approval_limit.toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (!currentBranch) {
    return (
      <div className="branch-error">
        <h2>No Branch Selected</h2>
        <p>Unable to determine active branch</p>
      </div>
    )
  }

  return <>{children}</>
}
