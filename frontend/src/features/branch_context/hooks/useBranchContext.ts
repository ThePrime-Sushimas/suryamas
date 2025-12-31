import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

export const useBranchContext = () => {
  const { currentBranch, isLoading, isLoaded } = useBranchContextStore()

  if (!currentBranch && !isLoading && isLoaded) {
    return null
  }

  return currentBranch
}

export const useRequiredBranchContext = () => {
  const branch = useBranchContext()
if (!branch) return null

}
