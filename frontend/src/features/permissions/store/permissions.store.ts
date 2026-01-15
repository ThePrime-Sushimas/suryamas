import { create } from 'zustand'
import { permissionsApi } from '../api/permissions.api'
import type { Module, Role, Permission } from '../types'

interface PermissionsState {
  modules: Module[]
  roles: Role[]
  permissions: Permission[]
  pendingChanges: Map<string, Partial<Permission>>
  loading: boolean
  saving: boolean
  error: string | null
  
  fetchModules: () => Promise<void>
  fetchRoles: () => Promise<void>
  fetchRolePermissions: (roleId: string) => Promise<void>
  createRole: (data: { name: string; description?: string }) => Promise<Role>
  updateRole: (id: string, data: { name?: string; description?: string }) => Promise<Role>
  deleteRole: (id: string) => Promise<void>
  updatePermissionLocal: (moduleId: string, field: string, value: boolean) => void
  savePermissions: (roleId: string) => Promise<void>
  discardChanges: () => void
  clearError: () => void
}

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  modules: [],
  roles: [],
  permissions: [],
  pendingChanges: new Map(),
  loading: false,
  saving: false,
  error: null,

  fetchModules: async () => {
    set({ loading: true, error: null })
    try {
      const modules = await permissionsApi.getModules()
      set({ modules, loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch modules'
      set({ error: message, loading: false })
    }
  },

  fetchRoles: async () => {
    set({ loading: true, error: null })
    try {
      const roles = await permissionsApi.getRoles()
      set({ roles, loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch roles'
      set({ error: message, loading: false })
    }
  },

  fetchRolePermissions: async (roleId) => {
    set({ loading: true, error: null, pendingChanges: new Map() })
    try {
      const permissions = await permissionsApi.getRolePermissions(roleId)
      set({ permissions, loading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch permissions'
      set({ error: message, loading: false })
    }
  },

  createRole: async (data) => {
    set({ loading: true, error: null })
    try {
      const role = await permissionsApi.createRole(data)
      set({ loading: false })
      return role
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create role'
      set({ error: message, loading: false })
      throw error
    }
  },

  updateRole: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const role = await permissionsApi.updateRole(id, data)
      set(state => ({
        roles: state.roles.map(r => r.id === id ? role : r),
        loading: false
      }))
      return role
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role'
      set({ error: message, loading: false })
      throw error
    }
  },

  deleteRole: async (id) => {
    try {
      await permissionsApi.deleteRole(id)
      set(state => ({ roles: state.roles.filter(r => r.id !== id) }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete role'
      set({ error: message })
      throw error
    }
  },

  updatePermissionLocal: (moduleId, field, value) => {
    set(state => {
      const key = moduleId
      const existing = state.pendingChanges.get(key) || {}
      const updated = new Map(state.pendingChanges)
      updated.set(key, { ...existing, [field]: value })
      return { pendingChanges: updated }
    })
  },

  savePermissions: async (roleId) => {
    const { pendingChanges } = get()
    if (pendingChanges.size === 0) return

    set({ saving: true, error: null })
    try {
      for (const [moduleId, changes] of pendingChanges.entries()) {
        await permissionsApi.updateRolePermission(roleId, moduleId, changes)
      }
      
      const updatedPermissions = await permissionsApi.getRolePermissions(roleId)
      set({ permissions: updatedPermissions, pendingChanges: new Map(), saving: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save permissions'
      set({ error: message, saving: false })
      throw error
    }
  },

  discardChanges: () => {
    set({ pendingChanges: new Map() })
  },

  clearError: () => set({ error: null })
}))
