import api from '../lib/axios'
import type { Role, Module, RoleWithPermissions } from '@/features/permissions'

export const permissionService = {
  async getRoles() {
    const { data } = await api.get<{ data: Role[] }>('/permissions/roles')
    return data.data
  },

  async getRoleById(id: string) {
    const { data } = await api.get<{ data: RoleWithPermissions }>(`/permissions/roles/${id}`)
    return data.data
  },

  async getModules() {
    const { data } = await api.get<{ data: Module[] }>('/permissions/modules')
    return data.data
  },

  async updatePermission(roleId: string, moduleId: string, permissions: {
    can_view?: boolean
    can_insert?: boolean
    can_update?: boolean
    can_delete?: boolean
    can_approve?: boolean
    can_release?: boolean
  }) {
    const { data } = await api.put(`/permissions/roles/${roleId}/permissions/${moduleId}`, permissions)
    return data
  },
}
