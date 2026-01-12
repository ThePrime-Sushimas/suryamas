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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users'
      set({ error: message, loading: false })
    }
  },

  assignRole: async (userId, roleId) => {
    set({ loading: true, error: null })
    try {
      const roleData = await usersApi.assignRole(userId, roleId)
      set(state => {
        const updatedUser = { 
          role_id: roleId, 
          role_name: roleData.role_name, 
          role_description: roleData.role_description 
        }
        return {
          users: state.users.map(u => u.employee_id === userId ? { ...u, ...updatedUser } : u),
          loading: false
        }
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to assign role'
      set({ error: message, loading: false })
      throw err
    }
  },

  removeRole: async (userId) => {
    set({ loading: true, error: null })
    try {
      await usersApi.removeRole(userId)
      set(state => ({
        users: state.users.map(u => u.employee_id === userId ? { ...u, role_id: null, role_name: null, role_description: null } : u),
        loading: false
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove role'
      set({ error: message, loading: false })
      throw err
    }
  },

  clearError: () => set({ error: null })
}))
