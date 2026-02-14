import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { parseApiError, setErrorToast } from './errorParser'
import { useToast } from '@/contexts/ToastContext'

const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/logout',
  '/auth/reset-password',
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

// Initialize toast for error handling
let toast: ReturnType<typeof useToast> | null = null
const getToast = () => {
  if (!toast) {
    try {
      toast = useToast()
    } catch {
      // Toast context not available
    }
  }
  return toast
}

// Set error toast function for centralized error handling
setErrorToast((message: string) => {
  const t = getToast()
  if (t) {
    t.error(message)
  } else {
    console.warn('[Toast not available]:', message)
  }
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
        // Instead of redirecting, create a proper axios error
        const axiosError = new axios.AxiosError(
          'Branch context required. Please select a branch.',
          'ERR_BRANCH_REQUIRED',
          config,
          undefined,
          {
            status: 401,
            statusText: 'Unauthorized',
            data: { message: 'Branch context required' },
            headers: {},
            config,
          }
        )
        return Promise.reject(axiosError)
      }
      
      config.headers['x-branch-id'] = branch.branch_id
    }

    return config
  },
  (error) => {
    // Convert non-axios errors to axios errors for consistent handling
    if (!axios.isAxiosError(error)) {
      const axiosError = new axios.AxiosError(
        error.message || 'Unknown error occurred',
        'ERR_UNKNOWN',
        error.config,
        undefined,
        {
          status: 500,
          statusText: 'Internal Server Error',
          data: { message: error.message },
          headers: {},
          config: error.config,
        }
      )
      return Promise.reject(axiosError)
    }
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }
    
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status
    const t = getToast()

    // Handle specific HTTP status codes with centralized messages
    switch (status) {
      case 401:
        // Token expired - try refresh
        if (!originalRequest._retry) {
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
            
            // Show toast and redirect
            if (t) {
              t.error('Session expired. Please login again.')
            }
            setTimeout(() => {
              window.location.href = '/login'
            }, 1500)
            return Promise.reject(refreshError)
          }
        }
        break

      case 403:
        // Permission denied - show toast
        if (t) {
          t.error('You do not have permission to perform this action.')
        }
        break

      case 404:
        // Resource not found - show toast for mutation requests (POST, PUT, DELETE)
        const method = originalRequest.method?.toUpperCase()
        if (method !== 'GET' && t) {
          const message = parseApiError(error, 'The requested resource was not found.')
          t.error(message)
        }
        break

      case 422:
      case 409:
        // Validation/Conflict error - show toast
        if (t) {
          const message = parseApiError(error, 'Operation could not be completed.')
          t.error(message)
        }
        break

      case 500:
      case 502:
      case 503:
      case 504:
        // Server errors - show generic message
        if (t) {
          t.error('Server error. Please try again later.')
        }
        break

      case 429:
        // Rate limited - show toast
        if (t) {
          t.error('Too many requests. Please wait a moment.')
        }
        break
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
