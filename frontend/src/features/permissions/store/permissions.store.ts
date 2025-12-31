import { create } from 'zustand'
import { permissionsApi } from '../api/permissions.api'
import type { Module, Role, Permission } from '../types'

interface PermissionsState {
  modules: Module[]
  roles: Role[]
  permissions: Permission[]
  loading: boolean
  error: string | null
  
  fetchModules: () => Promise<void>
  fetchRoles: () => Promise<void>
  fetchRolePermissions: (roleId: string) => Promise<void>
  createRole: (data: { name: string; description?: string }) => Promise<Role>
  updateRole: (id: string, data: { name?: string; description?: string }) => Promise<Role>
  deleteRole: (id: string) => Promise<void>
  updatePermission: (roleId: string, moduleId: string, data: Partial<Permission>) => Promise<void>
  clearError: () => void
}

export const usePermissionsStore = create<PermissionsState>((set) => ({
  modules: [],
  roles: [],
  permissions: [],
  loading: false,
  error: null,

  fetchModules: async () => {
    set({ loading: true, error: null })
    try {
      const modules = await permissionsApi.getModules()
      set({ modules, loading: false })
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to fetch modules', loading: false })
    }
  },

  fetchRoles: async () => {
    set({ loading: true, error: null })
    try {
      const roles = await permissionsApi.getRoles()
      set({ roles, loading: false })
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to fetch roles', loading: false })
    }
  },

  fetchRolePermissions: async (roleId) => {
    set({ loading: true, error: null })
    try {
      const permissions = await permissionsApi.getRolePermissions(roleId)
      set({ permissions, loading: false })
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to fetch permissions', loading: false })
    }
  },

  createRole: async (data) => {
    set({ loading: true, error: null })
    try {
      const role = await permissionsApi.createRole(data)
      set({ loading: false })
      return role
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to create role', loading: false })
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
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to update role', loading: false })
      throw error
    }
  },

  deleteRole: async (id) => {
    try {
      await permissionsApi.deleteRole(id)
      set(state => ({ roles: state.roles.filter(r => r.id !== id) }))
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to delete role' })
      throw error
    }
  },

  updatePermission: async (roleId, moduleId, data) => {
    try {
      await permissionsApi.updateRolePermission(roleId, moduleId, data)
      set(state => ({
        permissions: state.permissions.map(p => 
          p.role_id === roleId && p.module_id === moduleId ? { ...p, ...data } : p
        )
      }))
    } catch (error: unknown) {
      set({ error: error.response?.data?.error || 'Failed to update permission' })
      throw error
    }
  },

  clearError: () => set({ error: null })
}))
