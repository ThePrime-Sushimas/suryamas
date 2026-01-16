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
  timeout: 120000, // 2 minutes for large file uploads
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

    // Add audit headers for all requests
    if (config.headers) {
      config.headers['X-Client-Timestamp'] = new Date().toISOString()
      config.headers['X-Client-Platform'] = 'web'
      
      // Add file metadata for upload requests
      if (config.url?.includes('/upload') && config.data instanceof FormData) {
        const file = config.data.get('file') as File
        if (file) {
          config.data.append('metadata', JSON.stringify({
            original_filename: file.name,
            file_size: file.size,
            file_type: file.type,
            last_modified: file.lastModified,
            client_uploaded_at: new Date().toISOString()
          }))
        }
      }
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
    
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number }

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

    // Retry logic for transient failures (max 3 retries)
    const shouldRetry = (
      error.code === 'ECONNABORTED' || // Timeout
      error.code === 'ERR_NETWORK' ||  // Network issues
      error.response?.status === 429 || // Rate limit
      (error.response?.status && error.response.status >= 500) // Server errors
    )
    
    if (shouldRetry && (!originalRequest._retryCount || originalRequest._retryCount < 3)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, originalRequest._retryCount - 1) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
      
      return api(originalRequest)
    }

    // Transform error to standard format
    if (error.response?.data?.error) {
      const apiError = error.response.data.error
      const enhancedError = new Error(apiError.message || 'An error occurred') as Error & {
        code?: string
        details?: Record<string, unknown>
        timestamp?: string
      }
      enhancedError.code = apiError.code
      enhancedError.details = apiError.details
      enhancedError.timestamp = apiError.timestamp
      return Promise.reject(enhancedError)
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
