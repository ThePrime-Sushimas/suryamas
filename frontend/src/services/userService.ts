import api from '../lib/axios'

export interface User {
  employee_id: string
  email: string
  job_position: string
  full_name: string
  branch: string
  user_id: string | null
  has_account: boolean
  role_id: string | null
  role_name: string | null
  role_description: string | null
}

export const userService = {
  async getAll() {
    const { data } = await api.get<{ data: User[] }>('/users')
    return data.data
  },

  async assignRole(userId: string, roleId: string) {
    const { data } = await api.put(`/users/${userId}/role`, { role_id: roleId })
    return data
  },

  async removeRole(userId: string) {
    const { data } = await api.delete(`/users/${userId}/role`)
    return data
  },
}
