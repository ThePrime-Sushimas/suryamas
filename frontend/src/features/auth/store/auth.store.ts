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
  login: (email: string, password: string, remember?: boolean) => Promise<void>
  register: (email: string, password: string, employee_id: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

let _checkAuthPromise: Promise<void> | null = null

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  isInitialized: false,

  login: async (email, password, remember) => {
    set({ isLoading: true })
    try {
      const { data } = await api.post<ApiResponse<{ access_token: string; user: User }>>('/auth/login', {
        email,
        password,
      })
      // Always use localStorage so token works across tabs
      // "remember" controls whether we also set a flag to persist after browser close
      localStorage.setItem('token', data.data.access_token)
      if (remember) localStorage.setItem('remember', 'true')
      else localStorage.removeItem('remember')
      set({ token: data.data.access_token })
      
      // Fetch full profile data
      const { data: profileData } = await api.get<ApiResponse<User>>('/employees/profile')
      set({ user: profileData.data, isInitialized: true, isLoading: false })
    } catch (error: unknown) {
      set({ isLoading: false, isInitialized: true })
      throw error
    }
  },
  

  register: async (email, password, employee_id) => {
    set({ isLoading: true })
    await api.post('/auth/register', { email, password, employee_id })
    set({ isLoading: false })
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('remember')
      set({ user: null, token: null })
      
      // Clear branch context and permissions
      const { useBranchContextStore } = await import('@/features/branch_context/store/branchContext.store')
      const { usePermissionStore } = await import('@/features/branch_context/store/permission.store')
      useBranchContextStore.getState().clear()
      usePermissionStore.getState().clear()
    }
  },

  checkAuth: async () => {
    // Dedup: reuse in-flight promise (React StrictMode double-mount)
    if (_checkAuthPromise) return _checkAuthPromise
    _checkAuthPromise = (async () => {
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
        localStorage.removeItem('remember')
        set({ user: null, token: null, isInitialized: true })
      } finally {
        _checkAuthPromise = null
      }
    })()
    return _checkAuthPromise
  },
}))
