import api from '@/lib/axios'
import type { Module, Role, Permission } from '../types'

type ApiResponse<T> = { success: boolean; data: T }

export const permissionsApi = {
  // Modules
  getModules: async () => {
    const res = await api.get<ApiResponse<Module[]>>('/permissions/modules')
    return res.data.data
  },

  // Roles
  getRoles: async () => {
    const res = await api.get<ApiResponse<Role[]>>('/permissions/roles')
    return res.data.data
  },

  getRoleById: async (id: string) => {
    const res = await api.get<ApiResponse<Role>>(`/permissions/roles/${id}`)
    return res.data.data
  },

  createRole: async (data: { name: string; description?: string }) => {
    const res = await api.post<ApiResponse<Role>>('/permissions/roles', data)
    return res.data.data
  },

  updateRole: async (id: string, data: { name?: string; description?: string }) => {
    const res = await api.put<ApiResponse<Role>>(`/permissions/roles/${id}`, data)
    return res.data.data
  },

  deleteRole: async (id: string) => {
    await api.delete(`/permissions/roles/${id}`)
  },

  // Permissions
  getRolePermissions: async (roleId: string) => {
    const res = await api.get<ApiResponse<Permission[]>>(`/permissions/roles/${roleId}/permissions`)
    return res.data.data
  },

  updateRolePermission: async (roleId: string, moduleId: string, data: Partial<Permission>) => {
    const res = await api.put<ApiResponse<Permission>>(`/permissions/roles/${roleId}/permissions/${moduleId}`, data)
    return res.data.data
  }
}
