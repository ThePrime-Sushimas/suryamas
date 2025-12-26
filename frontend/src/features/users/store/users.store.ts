import { create } from 'zustand'
import { usersApi } from '../api/users.api'
import type { User } from '../types'

interface UsersState {
  users: User[]
  loading: boolean
  error: string | null
  
  fetchUsers: () => Promise<void>
  assignRole: (userId: string, roleId: string) => Promise<void>
  removeRole: (userId: string) => Promise<void>
  clearError: () => void
}

export const useUsersStore = create<UsersState>((set) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null })
    try {
      const users = await usersApi.getAll()
      set({ users, loading: false })
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to fetch users', loading: false })
    }
  },

  assignRole: async (userId, roleId) => {
    try {
      await usersApi.assignRole(userId, roleId)
      set(state => ({
        users: state.users.map(u => u.employee_id === userId ? { ...u, role_id: roleId } : u)
      }))
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to assign role' })
      throw error
    }
  },

  removeRole: async (userId) => {
    try {
      await usersApi.removeRole(userId)
      set(state => ({
        users: state.users.map(u => u.employee_id === userId ? { ...u, role_id: null, role_name: null } : u)
      }))
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to remove role' })
      throw error
    }
  },

  clearError: () => set({ error: null })
}))
