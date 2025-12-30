import { create } from 'zustand'
import type { PermissionMatrix, PermissionAction } from '@/features/branch_context/types'

interface PermissionState {
  permissions: PermissionMatrix
  isLoaded: boolean
  isLoading: boolean
  error: string | null

  setPermissions: (permissions: PermissionMatrix) => void
  hasPermission: (module: string, action: PermissionAction) => boolean | null
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: {},
  isLoaded: false,
  isLoading: false,
  error: null,

  setPermissions: (permissions) => {
    set({ permissions, isLoaded: true, error: null })
  },

  hasPermission: (module, action) => {
    const state = get()
    if (!state.isLoaded) return null
    const perms = state.permissions[module]
    return perms?.[action] || false
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
}))
