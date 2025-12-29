import axios from 'axios'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/logout',
  '/employee-branches/me',
  '/employees/profile',
]

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token and branch context
api.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Enforce branch context
    const isPublic = PUBLIC_ENDPOINTS.some(endpoint => config.url?.includes(endpoint))
    
    if (!isPublic) {
      const branch = useBranchContextStore.getState().currentBranch
      
      if (!branch) {
        throw new Error('Branch context missing - cannot make API call')
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
  async (error: any) => {
    const originalRequest = error.config

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
