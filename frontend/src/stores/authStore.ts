import { create } from 'zustand'
import api from '../lib/axios'
import type { User, ApiResponse } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, employee_id: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { data } = await api.post<ApiResponse<{ access_token: string; user: User }>>('/auth/login', {
        email,
        password,
      })
      localStorage.setItem('token', data.data.access_token)
      set({ user: data.data.user, token: data.data.access_token })
    } finally {
      set({ isLoading: false })
    }
  },

  register: async (email, password, employee_id) => {
    set({ isLoading: true })
    try {
      await api.post('/auth/register', { email, password, employee_id })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      localStorage.removeItem('token')
      set({ user: null, token: null })
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ user: null, token: null })
      return
    }
    
    try {
      const { data } = await api.get<ApiResponse<User>>('/auth/profile')
      set({ user: data.data, token })
    } catch (error) {
      localStorage.removeItem('token')
      set({ user: null, token: null })
    }
  },
}))
