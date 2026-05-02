import { useBranchContextStore } from '../store/branchContext.store'

export const useBranchAccess = () => {
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  return {
    isReadOnly: currentBranch?.is_read_only ?? false,
    branchStatus: currentBranch?.branch_status ?? 'active',
    isClosed: currentBranch?.branch_status === 'closed',
  }
}
