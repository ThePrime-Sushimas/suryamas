import { create } from 'zustand'
import type { PermissionMatrix, PermissionAction } from '@/features/branch_context/types'

interface PermissionState {
  permissions: PermissionMatrix
  isLoaded: boolean
  isLoading: boolean
  error: string | null

  setPermissions: (permissions: PermissionMatrix) => void
  hasPermission: (module: string, action: PermissionAction) => boolean
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
  reload: () => Promise<void>  // Add reload method
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: {},
  isLoaded: false,
  isLoading: false,
  error: null,

  setPermissions: (permissions) => {
    set({ permissions, isLoaded: true, isLoading: false, error: null })
  },

  hasPermission: (module, action) => {
    const state = get()
    if (!state.isLoaded) return false
    return state.permissions[module]?.[action] ?? false
  },

  setLoading: (loading) => {
    set({ isLoading: loading })
  },

  setError: (error) => {
    set({ error, isLoading: false })
  },

  clear: () => {
    set({ permissions: {}, isLoaded: false, isLoading: false, error: null })
  },

  reload: async () => {
    // Trigger permission reload by clearing and letting PermissionProvider refetch
    set({ isLoaded: false })
    // The PermissionProvider will detect isLoaded=false and refetch
  },
}))
