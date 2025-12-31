import { create } from 'zustand'
import api from '@/lib/axios'

interface User {
  id: string
  email: string
  full_name: string
  job_position: string
  created_at: string
  is_active?: boolean
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isInitialized: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, employee_id: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  isInitialized: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { data } = await api.post<ApiResponse<{ access_token: string; user: User }>>('/auth/login', {
        email,
        password,
      })
      localStorage.setItem('token', data.data.access_token)
      set({ token: data.data.access_token })
      
      // Fetch full profile data
      const { data: profileData } = await api.get<ApiResponse<User>>('/employees/profile')
      set({ user: profileData.data, isInitialized: true })
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
      
      // Clear branch context and permissions
      const { useBranchContextStore } = await import('@/features/branch_context/store/branchContext.store')
      const { usePermissionStore } = await import('@/features/branch_context/store/permission.store')
      useBranchContextStore.getState().clear()
      usePermissionStore.getState().clear()
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ user: null, token: null, isInitialized: true })
      return
    }
    
    try {
      const { data } = await api.get<ApiResponse<User>>('/employees/profile')
      set({ user: data.data, token, isInitialized: true })
    } catch {
      localStorage.removeItem('token')
      set({ user: null, token: null, isInitialized: true })
    }
  },
}))
