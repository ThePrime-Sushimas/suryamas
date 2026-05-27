import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

/**
 * Returns only branches the current user has access to (active only).
 * Use this for transaction forms (PR, PO, GR, Production Order, etc.)
 * where user should only pick branches they're assigned to.
 *
 * For admin pages that need ALL branches, use useActiveBranches from the API.
 */
export function useUserBranches() {
  const branches = useBranchContextStore(s => s.branches)
  return branches
    .filter(b => b.branch_status === 'active')
    .map(b => ({ id: b.branch_id, branch_name: b.branch_name, company_id: b.company_id }))
}
