import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

export const useBranchContext = () => {
  const { currentBranch } = useBranchContextStore()

  if (!currentBranch) {
    throw new Error('Branch context not available')
  }

  return currentBranch
}
