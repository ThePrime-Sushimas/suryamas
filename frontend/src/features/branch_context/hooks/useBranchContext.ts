import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import type { BranchContext } from '@/features/branch_context/types'

export const useBranchContext = (): BranchContext | null => {
  return useBranchContextStore((state) => state.currentBranch)
}

export const useRequiredBranchContext = (): BranchContext => {
  const { currentBranch, isLoading, isLoaded, error } = useBranchContextStore()
  
  if (error) {
    throw new Error(`Branch context error: ${error}`)
  }
  
  if (!isLoaded || isLoading) {
    throw new Error('Branch context is still loading')
  }
  
  if (!currentBranch) {
    throw new Error('No branch context available. Please select a branch.')
  }
  
  return currentBranch
}
