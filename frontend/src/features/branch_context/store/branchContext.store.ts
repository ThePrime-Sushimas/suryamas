import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BranchContext {
  branch_id: string
  branch_name: string
  company_id: string
  role_id: string
  approval_limit: number
}

interface BranchContextState {
  currentBranch: BranchContext | null
  branches: BranchContext[]
  isLoaded: boolean

  setBranches: (branches: BranchContext[]) => void
  switchBranch: (branchId: string) => void
  clear: () => void
}

export const useBranchContextStore = create<BranchContextState>()(
  persist(
    (set, get) => ({
      currentBranch: null,
      branches: [],
      isLoaded: false,

      setBranches: (branches) => {
        const current = get().currentBranch
        const validCurrent = current && branches.find(b => b.branch_id === current.branch_id)
        
        set({
          branches,
          currentBranch: validCurrent || (branches.length === 1 ? branches[0] : null),
          isLoaded: true,
        })
      },

      switchBranch: (branchId) => {
        const branches = get().branches
        const branch = branches.find(b => b.branch_id === branchId)
        
        if (!branch) {
          console.error('Invalid branch:', branchId, 'Available:', branches)
          return
        }
        
        set({ currentBranch: branch })
        
        // Clear all caches on switch
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('branch-switched', { detail: branch }))
        }
      },

      clear: () => {
        set({
          currentBranch: null,
          branches: [],
          isLoaded: false,
        })
      },
    }),
    {
      name: 'erp:branch-context',
      partialize: (state) => ({
        currentBranch: state.currentBranch,
        branches: state.branches,
      }),
    }
  )
)
