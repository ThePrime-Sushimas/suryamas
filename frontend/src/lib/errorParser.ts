import axios from 'axios'
import { reportErrorToMonitoring, categorizeError, type ErrorCategory } from '@/utils/error-monitoring.util'

// Error context interface
interface ErrorContext {
  module?: string
  action?: string
  [key: string]: unknown
}

// Toast type for user feedback
type ToastType = 'success' | 'error' | 'info' | 'warning'

// Default error messages by HTTP status
const ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Session expired. Please login again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'Conflict: The resource already exists.',
  422: 'Validation error. Please check your input.',
  429: 'Too many requests. Please wait a moment.',
  500: 'Internal server error. Please try again later.',
  502: 'Service unavailable. Please try again later.',
  503: 'Server is temporarily unavailable.',
  504: 'Gateway timeout. Please try again.',
}

// Toast function type (to be set from outside)
let toastFn: ((message: string, type?: ToastType) => void) | null = null

/**
 * Set toast function for user notifications
 * Should be called once at app initialization
 */
export function setErrorToast(toast: (message: string, type?: ToastType) => void): void {
  toastFn = toast
}

/**
 * Get user-friendly error message from error response
 * @param err - Unknown error object from catch block
 * @param fallbackMessage - Fallback message if error cannot be parsed
 * @returns User-friendly error message
 */
export function parseApiError(err: unknown, fallbackMessage: string): string {
  // Check for Axios error response
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosError = err as { response?: { data?: { error?: string; message?: string } } }
    return axiosError.response?.data?.error || 
           axiosError.response?.data?.message || 
           fallbackMessage
  }
  // Check for standard Error instance
  if (err instanceof Error) {
    return err.message
  }
  return fallbackMessage
}

/**
 * Get HTTP status code from error
 */
function getStatusCode(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null
  }
  return null
}

/**
 * Get error message based on status code
 */
function getMessageByStatus(status: number | null, fallback: string): string {
  if (status && ERROR_MESSAGES[status]) {
    return ERROR_MESSAGES[status]
  }
  return fallback
}

/**
 * Centralized error handler for frontend
 * Handles errors consistently across the application
 * 
 * @param error - The caught error
 * @param context - Context information (module, action, etc.)
 * @param options - Configuration options
 */
export function handleError(
  error: unknown,
  context: ErrorContext,
  options: {
    /** Show toast notification to user */
    showToast?: boolean
    /** Toast type (default: error) */
    toastType?: ToastType
    /** Custom error message (overrides default) */
    message?: string
    /** Log to error monitoring service */
    logToMonitoring?: boolean
    /** Additional data to log */
    additionalData?: Record<string, unknown>
  } = {}
): void {
  const {
    showToast = true,
    toastType = 'error',
    message: customMessage,
    logToMonitoring = true,
    additionalData = {}
  } = options

  const status = getStatusCode(error)
  const errorMessage = customMessage || 
    parseApiError(error, getMessageByStatus(status, 'An unexpected error occurred'))

  // Log to console with context
  console.error(`[${context.module || 'App'}] Error in ${context.action || 'operation'}:`, {
    message: errorMessage,
    status,
    ...additionalData,
    error
  })

  // Report to monitoring service
  if (logToMonitoring && error instanceof Error) {
    try {
      const category: ErrorCategory = categorizeError(error)
      reportErrorToMonitoring({
        error: {
          name: error.name,
          message: errorMessage,
          stack: error.stack
        },
        category,
        context: {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          route: window.location.pathname,
          ...additionalData
        },
        module: context.module || 'Unknown',
        businessImpact: category.requiresAdminAttention ? 'Requires admin attention' : undefined
      })
    } catch (monitoringError) {
      console.error('Failed to report to monitoring:', monitoringError)
    }
  }

  // Show toast notification
  if (showToast && toastFn) {
    // Handle specific HTTP status codes with appropriate messages
    let toastMessage = errorMessage
    
    if (status === 401) {
      toastMessage = 'Session expired. Please login again.'
    } else if (status === 403) {
      toastMessage = 'You do not have permission to perform this action.'
    } else if (!status && errorMessage === 'An unexpected error occurred') {
      toastMessage = 'An unexpected error occurred. Please try again.'
    }
    
    toastFn(toastMessage, toastType)
  }

  // Handle redirect for auth errors
  if (status === 401) {
    // Delay redirect to allow toast to show
    setTimeout(() => {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      window.location.href = '/login'
    }, 1500)
  }
}

/**
 * Handle API error with automatic toast
 * Convenience function for common use case
 */
export function handleApiError(error: unknown, context: ErrorContext): string {
  const status = getStatusCode(error)
  const message = parseApiError(error, getMessageByStatus(status, 'Operation failed'))
  
  handleError(error, context, { showToast: true })
  
  return message
}

/**
 * Check if error is a cancellation error
 */
export function isCancellationError(error: unknown): boolean {
  if (axios.isCancel(error)) return true
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.name === 'CanceledError'
  }
  return false
}

/**
 * Create error handler for specific module
 * Returns a function with pre-set module context
 */
export function createErrorHandler(module: string) {
  return (error: unknown, action: string, options?: Parameters<typeof handleError>[1]) => {
    handleError(error, { module, action, ...options })
  }
}

// Re-export for convenience
export { type ErrorContext, type ToastType }
