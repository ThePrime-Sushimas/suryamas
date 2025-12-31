import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BranchContext } from '@/features/branch_context/types'

interface BranchContextState {
  currentBranch: BranchContext | null
  branches: BranchContext[]
  isLoaded: boolean
  isLoading: boolean
  error: string | null

  setBranches: (branches: BranchContext[]) => void
  switchBranch: (branchId: string) => boolean
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
}

export const useBranchContextStore = create<BranchContextState>()(
  persist(
    (set, get) => ({
      currentBranch: null,
      branches: [],
      isLoaded: false,
      isLoading: false,
      error: null,

      setBranches: (branches) => {
        const current = get().currentBranch
        const validCurrent = current && branches.find(b => b.branch_id === current.branch_id)
        
        set({
          branches,
          currentBranch: validCurrent || null,
          isLoaded: true,
          error: null,
        })
      },

      switchBranch: (branchId) => {
        const branches = get().branches
        const branch = branches.find(b => b.branch_id === branchId)
        
        if (!branch) {
          set({ error: `Invalid branch: ${branchId}` })
          return false
        }
        
        set({ currentBranch: branch, error: null })
        return true
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error, isLoading: false })
      },

      clear: () => {
        set({
          currentBranch: null,
          branches: [],
          isLoaded: false,
          isLoading: false,
          error: null,
        })
      },
    }),
    {
      name: 'erp:branch-context',
      partialize: (state) => ({
        currentBranch: state.currentBranch,
      }),
    }
  )
)
