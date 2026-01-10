// Supplier Product Error Parser - Handle API errors with user-friendly messages

interface ApiErrorResponse {
  error?: string
  message?: string
  code?: string
  details?: Record<string, unknown>
}

interface AxiosApiError {
  response?: {
    data?: ApiErrorResponse
  }
  message?: string
}

/**
 * Parse API error and return user-friendly message
 * @param error - Error object from API call
 * @returns User-friendly error message
 */
export function parseSupplierProductError(error: unknown): string {
  // Check if it's an API error with response
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as AxiosApiError
    const err = apiError.response?.data

    if (!err) {
      return 'An unexpected error occurred. Please try again.'
    }

    // Handle specific error codes
    switch (err.code) {
      case 'SUPPLIER_PRODUCT_NOT_FOUND':
        return 'The supplier product you are looking for was not found. It may have been deleted.'

      case 'DUPLICATE_SUPPLIER_PRODUCT':
        return 'This product already has a price from this supplier. Please edit the existing record instead.'

      case 'INVALID_SUPPLIER': {
        const reason = err.details && typeof err.details === 'object' && 'reason' in err.details 
          ? String(err.details.reason) 
          : undefined
        if (reason === 'not_found') {
          return 'The selected supplier was not found. Please select a different supplier.'
        }
        if (reason === 'inactive') {
          return 'The selected supplier is inactive. Please select an active supplier.'
        }
        if (reason === 'deleted') {
          return 'The selected supplier has been deleted. Please select a different supplier.'
        }
        return 'The selected supplier is not valid.'
      }

      case 'INVALID_PRODUCT': {
        const reason = err.details && typeof err.details === 'object' && 'reason' in err.details 
          ? String(err.details.reason) 
          : undefined
        if (reason === 'not_found') {
          return 'The selected product was not found. Please select a different product.'
        }
        if (reason === 'inactive') {
          return 'The selected product is inactive. Please select an active product.'
        }
        if (reason === 'deleted') {
          return 'The selected product has been deleted. Please select a different product.'
        }
        return 'The selected product is not valid.'
      }

      case 'INVALID_PRICE': {
        const min = err.details && typeof err.details === 'object' && 'min' in err.details 
          ? Number(err.details.min) 
          : 0
        const max = err.details && typeof err.details === 'object' && 'max' in err.details 
          ? Number(err.details.max) 
          : 999999999999
        return `Price must be between ${min} and ${max}. Please enter a valid price.`
      }

      case 'INVALID_CURRENCY': {
        const validCurrencies = err.details && typeof err.details === 'object' && 'valid_currencies' in err.details && Array.isArray(err.details.valid_currencies)
          ? err.details.valid_currencies.join(', ')
          : 'IDR, USD, EUR, SGD, MYR'
        return `The selected currency is not supported. Please choose from: ${validCurrencies}`
      }

      case 'BULK_OPERATION_LIMIT_EXCEEDED': {
        const limit = err.details && typeof err.details === 'object' && 'limit' in err.details 
          ? Number(err.details.limit) 
          : 100
        const attempted = err.details && typeof err.details === 'object' && 'attempted' in err.details 
          ? Number(err.details.attempted) 
          : 0
        return `You can only delete ${limit} items at once. You selected ${attempted} items. Please reduce your selection.`
      }

      case 'MAX_PREFERRED_SUPPLIERS_EXCEEDED': {
        const maxAllowed = err.details && typeof err.details === 'object' && 'max_allowed' in err.details 
          ? Number(err.details.max_allowed) 
          : 3
        return `A product can only have ${maxAllowed} preferred suppliers. Please deselect another preferred supplier first.`
      }

      case 'SUPPLIER_PRODUCT_VALIDATION_ERROR':
        return err.message || 'Please check your input and try again.'

      default:
        // Use error or message field
        if (err.error) return err.error
        if (err.message) return err.message
    }
  }

  // Handle network errors or other errors
  if (error instanceof Error) {
    // Filter out cancel/abort errors
    if (error.name === 'CanceledError' || error.name === 'AbortError') {
      return ''
    }
    return error.message
  }

  return 'An unexpected error occurred. Please try again.'
}

/**
 * Check if error should be silently ignored (e.g., canceled requests)
 * @param error - Error object
 * @returns True if error should be ignored
 */
export function isIgnorableError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'CanceledError' || error.name === 'AbortError'
  }
  return false
}

/**
 * Get error field-specific message for form validation
 * @param error - Error object from form submission
 * @param fieldName - Name of the field
 * @returns Error message for the field or null
 */
export function getFieldError(error: unknown, fieldName: string): string | null {
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as AxiosApiError
    const err = apiError.response?.data

    if (err?.details && typeof err.details === 'object') {
      // Check if field has specific error in details
      if (fieldName in err.details) {
        const fieldError = err.details[fieldName as keyof typeof err.details]
        if (typeof fieldError === 'string') return fieldError
        if (Array.isArray(fieldError)) return fieldError[0] as string
      }
    }
  }
  return null
}

