import api from '@/lib/axios'
import type { User, UserRole } from '../types'

type ApiResponse<T> = { success: boolean; data: T }

export const usersApi = {
  getAll: async () => {
    const res = await api.get<ApiResponse<User[]>>('/users')
    return res.data.data
  },

  getById: async (userId: string) => {
    const res = await api.get<ApiResponse<User>>(`/users/${userId}`)
    return res.data.data
  },

  getUserRole: async (userId: string) => {
    const res = await api.get<ApiResponse<UserRole | null>>(`/users/${userId}/role`)
    return res.data.data
  },
}
