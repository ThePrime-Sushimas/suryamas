import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BranchContext } from '@/features/branch_context/types'
import { branchApi } from '@/features/branch_context/api/branchContext.api'
import { usePermissionStore } from './permission.store'

interface BranchContextState {
  currentBranch: BranchContext | null
  branches: BranchContext[]
  isLoaded: boolean
  isLoading: boolean
  error: string | null

  setBranches: (branches: BranchContext[]) => void
  switchBranch: (branchId: string) => boolean
  switchBranchWithPermissions: (branchId: string) => Promise<{ success: boolean; error?: string }>
  refetchBranches: () => Promise<void>
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
          error: validCurrent === undefined && current ? 'Your branch access has changed' : null,
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

      switchBranchWithPermissions: async (branchId) => {
        const { branches, currentBranch } = get()
        const branch = branches.find(b => b.branch_id === branchId)
        
        if (!branch) {
          set({ error: `Invalid branch: ${branchId}` })
          return { success: false, error: 'Invalid branch' }
        }
        
        if (branch.branch_id === currentBranch?.branch_id) {
          return { success: true }
        }
        
        set({ isLoading: true, error: null })
        
        try {
          const permissions = await branchApi.getPermissions(branch.role_id)
          
          set({ 
            currentBranch: branch,
            isLoading: false,
            error: null,
          })
          
          usePermissionStore.getState().setPermissions(permissions)
          
          return { success: true }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to switch branch'
          set({ 
            isLoading: false,
            error: errorMessage,
          })
          return { success: false, error: errorMessage }
        }
      },

      refetchBranches: async () => {
        set({ isLoading: true, error: null })
        try {
          const userBranches = await branchApi.getUserBranches()
          get().setBranches(userBranches)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to refresh branches'
          set({ error: errorMessage })
        } finally {
          set({ isLoading: false })
        }
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
        branches: state.branches,
      }),
    }
  )
)
