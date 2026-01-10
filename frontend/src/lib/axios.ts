import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/logout',
]

const BRANCH_AGNOSTIC_ENDPOINTS = [
  '/roles',
  '/branches',
  '/employee-branches',
  '/employees/profile',
  '/permissions/me',
]

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token and branch context
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Enforce branch context
    const isPublic = PUBLIC_ENDPOINTS.some(endpoint => config.url?.startsWith(endpoint))
    const isBranchAgnostic = BRANCH_AGNOSTIC_ENDPOINTS.some(endpoint => config.url?.startsWith(endpoint))
    
    if (!isPublic && !isBranchAgnostic) {
      const branch = useBranchContextStore.getState().currentBranch
      
      if (!branch) {
        // Redirect to branch selection instead of throwing error
        window.location.href = '/'
        return Promise.reject(new Error('Branch context required'))
      }
      
      config.headers['x-branch-id'] = branch.branch_id
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }
    
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Token expired - try refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          // Call refresh endpoint
          // const { data } = await axios.post('/auth/refresh', { refreshToken })
          // localStorage.setItem('token', data.token)
          // return api(originalRequest)
        }
      } catch (refreshError) {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    // Retry logic for network errors
    if (!error.response && !originalRequest._retry) {
      originalRequest._retry = true
      return api(originalRequest)
    }

    return Promise.reject(error)
  }
)

// Request cancellation helper
export const createCancelToken = () => {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  }
}

export default api
