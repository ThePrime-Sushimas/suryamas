/**
 * Pos Aggregates Error Handling
 * Module-specific error types and utilities
 * 
 * Patterns followed:
 * - Feature-specific error parser (like pricelists/utils/errorParser.ts)
 * - Error codes matching backend pos-aggregates.errors.ts
 */

import { AxiosError } from 'axios'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Standard error structure for pos-aggregates
 */
export interface PosAggregateError {
  code: string
  message: string
  details?: unknown
  timestamp: number
}

/**
 * Error codes specific to pos-aggregates feature
 * Matches backend error codes in pos-aggregates.errors.ts
 */
export const ErrorCodes = {
  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  
  // Fetch errors
  FETCH_LIST_ERROR: 'FETCH_LIST_ERROR',
  FETCH_DETAIL_ERROR: 'FETCH_DETAIL_ERROR',
  FETCH_SUMMARY_ERROR: 'FETCH_SUMMARY_ERROR',
  
  // CRUD errors
  CREATE_ERROR: 'CREATE_ERROR',
  UPDATE_ERROR: 'UPDATE_ERROR',
  DELETE_ERROR: 'DELETE_ERROR',
  RESTORE_ERROR: 'RESTORE_ERROR',
  
  // Business logic errors (matching backend)
  RECONCILE_ERROR: 'RECONCILE_ERROR',
  BATCH_RECONCILE_ERROR: 'BATCH_RECONCILE_ERROR',
  ASSIGN_JOURNAL_ERROR: 'ASSIGN_JOURNAL_ERROR',
  BATCH_ASSIGN_JOURNAL_ERROR: 'BATCH_ASSIGN_JOURNAL_ERROR',
  GENERATE_JOURNAL_ERROR: 'GENERATE_JOURNAL_ERROR',
  
  // Job errors
  JOB_CREATE_ERROR: 'JOB_CREATE_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// =============================================================================
// ERROR FACTORY
// =============================================================================

/**
 * Factory function to create typed errors
 */
export function createError(
  message: string,
  code: ErrorCode = ErrorCodes.UNKNOWN_ERROR,
  details?: unknown
): PosAggregateError {
  return {
    code,
    message,
    details,
    timestamp: Date.now(),
  }
}

// =============================================================================
// ERROR PARSER
// =============================================================================

interface BackendError {
  message?: string
  error?: string
  details?: Record<string, string[]>
  statusCode?: number
}

/**
 * Parse backend error to user-friendly message
 * Handles validation errors, business rule violations, and network errors
 */
export function parsePosAggregateError(error: unknown): string {
  // Network error
  if (!error) {
    return 'An unexpected error occurred'
  }

  // Axios error
  if (error instanceof AxiosError) {
    const data = error.response?.data as BackendError | undefined

    // No response (network error)
    if (!error.response) {
      return 'Network error. Please check your connection.'
    }

    // Backend validation errors
    if (data?.details) {
      const firstError = Object.values(data.details)[0]?.[0]
      return firstError || 'Validation error'
    }

    // Backend error message
    if (data?.message) {
      return data.message
    }

    if (data?.error) {
      return data.error
    }

    // HTTP status messages
    switch (error.response.status) {
      case 400:
        return 'Invalid request. Please check your input.'
      case 401:
        return 'Unauthorized. Please login again.'
      case 403:
        return 'You do not have permission to perform this action.'
      case 404:
        return 'Transaction not found.'
      case 409:
        return 'Conflict: The resource already exists.'
      case 422:
        return 'Validation failed. Please check your input.'
      case 500:
        return 'Server error. Please try again later.'
      default:
        return `Error: ${error.response.status}`
    }
  }

  // Generic error
  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred'
}

/**
 * Parse field-specific validation errors
 */
export function parseFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof AxiosError) {
    const data = error.response?.data as BackendError | undefined
    if (data?.details) {
      const fieldErrors: Record<string, string> = {}
      Object.entries(data.details).forEach(([field, messages]) => {
        fieldErrors[field] = messages[0] || 'Invalid value'
      })
      return fieldErrors
    }
  }
  return {}
}

