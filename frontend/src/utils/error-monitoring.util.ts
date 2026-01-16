/**
 * Error Monitoring Utility
 * 
 * Provides error categorization, reporting, and monitoring for ERP operations
 */

export type ErrorType = 'DATA_VALIDATION' | 'NETWORK' | 'PERMISSION' | 'SYSTEM' | 'BUSINESS_RULE'
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface ErrorCategory {
  type: ErrorType
  severity: ErrorSeverity
  recoverable: boolean
  requiresAdminAttention: boolean
}

export interface ErrorReport {
  error: {
    name: string
    message: string
    stack?: string
  }
  category: ErrorCategory
  context: {
    userId?: string
    branchId?: string
    timestamp: string
    userAgent: string
    url: string
    route: string
    [key: string]: unknown
  }
  module: string
  submodule?: string
  businessImpact?: string
}

/**
 * Categorize error based on message and type
 */
export const categorizeError = (error: Error): ErrorCategory => {
  const message = error.message.toLowerCase()
  
  // Network errors
  if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
    return { 
      type: 'NETWORK', 
      severity: 'MEDIUM', 
      recoverable: true, 
      requiresAdminAttention: false 
    }
  }
  
  // Permission errors
  if (message.includes('permission') || message.includes('access denied') || message.includes('unauthorized')) {
    return { 
      type: 'PERMISSION', 
      severity: 'HIGH', 
      recoverable: false, 
      requiresAdminAttention: true 
    }
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return { 
      type: 'DATA_VALIDATION', 
      severity: 'MEDIUM', 
      recoverable: true, 
      requiresAdminAttention: false 
    }
  }
  
  // Business rule violations
  if (message.includes('business rule') || message.includes('constraint') || message.includes('duplicate')) {
    return { 
      type: 'BUSINESS_RULE', 
      severity: 'HIGH', 
      recoverable: false, 
      requiresAdminAttention: true 
    }
  }
  
  // Default: System error
  return { 
    type: 'SYSTEM', 
    severity: 'CRITICAL', 
    recoverable: false, 
    requiresAdminAttention: true 
  }
}

/**
 * Report error to monitoring system
 */
export const reportErrorToMonitoring = (report: ErrorReport): void => {
  // Console logging for development
  console.error(`[${report.category.severity}] ${report.module} Error:`, report)
  
  // Send to backend monitoring endpoint (non-blocking)
  if (typeof window !== 'undefined') {
    fetch('/api/v1/monitoring/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true
    }).catch(() => {
      // Silently fail if monitoring service is down
    })
  }
}

/**
 * Get error title based on category
 */
export const getErrorTitle = (category?: ErrorCategory): string => {
  if (!category) return 'Something went wrong'
  
  switch (category.type) {
    case 'NETWORK':
      return 'Connection Issue'
    case 'PERMISSION':
      return 'Access Denied'
    case 'DATA_VALIDATION':
      return 'Invalid Data'
    case 'BUSINESS_RULE':
      return 'Business Rule Violation'
    case 'SYSTEM':
      return 'System Error'
    default:
      return 'Something went wrong'
  }
}

/**
 * Get error description based on category
 */
export const getErrorDescription = (category?: ErrorCategory): string => {
  if (!category) return 'An unexpected error occurred. Please try again.'
  
  switch (category.type) {
    case 'NETWORK':
      return 'Network connection issue detected. Please check your internet connection and try again.'
    case 'PERMISSION':
      return 'You do not have permission to perform this action. Please contact your administrator.'
    case 'DATA_VALIDATION':
      return 'The data provided is invalid. Please check your input and try again.'
    case 'BUSINESS_RULE':
      return 'This action violates business rules. Please review the requirements and try again.'
    case 'SYSTEM':
      return 'A system error occurred. Our team has been notified. Please try again later.'
    default:
      return 'An unexpected error occurred. Please try again.'
  }
}

/**
 * Assess business impact of error
 */
export const assessBusinessImpact = (category: ErrorCategory): string => {
  if (category.severity === 'CRITICAL') {
    return 'HIGH - Critical business operation affected'
  }
  if (category.severity === 'HIGH') {
    return 'MEDIUM - Important business operation affected'
  }
  return 'LOW - Minor impact on business operations'
}
