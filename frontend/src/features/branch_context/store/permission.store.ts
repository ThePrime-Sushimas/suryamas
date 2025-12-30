import { create } from 'zustand'

export interface PermissionMatrix {
  [moduleName: string]: {
    view: boolean
    insert: boolean
    update: boolean
    delete: boolean
    approve: boolean
    release: boolean
  }
}

interface PermissionState {
  permissions: PermissionMatrix
  isLoaded: boolean

  setPermissions: (permissions: PermissionMatrix) => void
  hasPermission: (module: string, action: keyof PermissionMatrix[string]) => boolean
  clear: () => void
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: {},
  isLoaded: false,

  setPermissions: (permissions) => {
    set({ permissions, isLoaded: true })
  },

  hasPermission: (module, action) => {
    const perms = get().permissions[module]
    return perms?.[action] || false
  },

  clear: () => {
    set({ permissions: {}, isLoaded: false })
  },
}))
