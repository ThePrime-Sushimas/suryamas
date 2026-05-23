import { create } from 'zustand'
import { usersApi } from '../api/users.api'
import type { User } from '../types'

interface UsersState {
  users: User[]
  loading: boolean
  error: string | null
  fetchUsers: () => Promise<void>
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
    } catch (error: unknown) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load users',
      })
    }
  },
}))
