/**
 * Pricelist Error Parser
 * Converts backend errors to user-friendly messages
 * 
 * @module pricelists/utils/errorParser
 */

import { AxiosError } from 'axios'

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
export function parsePricelistError(error: unknown): string {
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
      // Handle specific restore error
      if (data.message.includes('active pricelist already exists')) {
        return 'Cannot restore: Another active pricelist exists for this supplier-product-UOM combination. Please delete or deactivate the existing one first.'
      }
      
      // Handle duplicate constraint error
      if (data.message.includes('duplicate key value') || data.message.includes('unique constraint')) {
        return 'Cannot restore: This would create a duplicate active pricelist. Please check for existing active pricelists.'
      }
      
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
        return 'Pricelist not found.'
      case 409:
        return 'Cannot complete action: A conflict exists (duplicate active pricelist or constraint violation).'
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
