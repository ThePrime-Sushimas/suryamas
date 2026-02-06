import { Response } from 'express'
import { ZodError } from '@/lib/openapi'
import { sendError } from './response.util'
import { logError } from '../config/logger'

// Import base error classes only (no module-specific imports to avoid circular dependencies)
import {
  AppError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  AuthenticationError,
  PermissionError,
  ErrorCategory
} from './errors.base'

// Import ErrorRegistry for dynamic error class loading
import { ERROR_REGISTRY, ErrorRegistryKey } from '../config/error-registry'
import { loadErrorClass, identifyError } from './error-registry.util'

// Re-export base error classes for convenience
export {
  AppError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  AuthenticationError,
  PermissionError
}

/**
 * Get error category from error name
 */
function getErrorCategoryByName(errorName: string): ErrorCategory {
  const config = Object.values(ERROR_REGISTRY).find(c => c.name === errorName)
  switch (config?.category) {
    case 'reconciliation': return ErrorCategory.BUSINESS_RULE
    case 'accounting': return ErrorCategory.BUSINESS_RULE
    case 'inventory': return ErrorCategory.BUSINESS_RULE
    case 'payment': return ErrorCategory.BUSINESS_RULE
    case 'banking': return ErrorCategory.BUSINESS_RULE
    case 'core': return ErrorCategory.SYSTEM
    case 'procurement': return ErrorCategory.BUSINESS_RULE
    case 'pos': return ErrorCategory.BUSINESS_RULE
    case 'pricing': return ErrorCategory.BUSINESS_RULE
    case 'permission': return ErrorCategory.PERMISSION
    case 'user': return ErrorCategory.AUTHENTICATION
    case 'hr': return ErrorCategory.SYSTEM
    case 'system': return ErrorCategory.SYSTEM
    default: return ErrorCategory.SYSTEM
  }
}

/**
 * Check if error is a module-specific error by checking its name against registry
 */
async function isModuleError(error: unknown, errorName: string): Promise<boolean> {
  if (!(error instanceof Error)) return false
  if (error.name === errorName) return true
  
  // Try dynamic loading and instanceof check
  const ErrorClass = await loadErrorClass(errorName as ErrorRegistryKey)
  if (ErrorClass && error instanceof ErrorClass) {
    return true
  }
  
  return false
}

/**
 * Main error handler function
 * Handles errors dari semua module menggunakan ErrorRegistry untuk dynamic loading
 */
export const handleError = async (res: Response, error: unknown): Promise<void> => {
  // ==========================================================================
  // BASE ERROR CLASSES (AppError subclasses) - Fast path
  // ==========================================================================
  
  // NotFoundError - Resource not found
  if (error instanceof NotFoundError) {
    logError('NOT_FOUND', {
      message: error.message,
      context: (error as NotFoundError).context
    })
    sendError(res, error.message, 404)
    return
  }

  // ConflictError - Duplicate or conflict
  if (error instanceof ConflictError) {
    logError('CONFLICT', {
      message: error.message,
      context: (error as ConflictError).context
    })
    sendError(res, error.message, 409)
    return
  }

  // ValidationError - Input validation failed
  if (error instanceof ValidationError) {
    logError('VALIDATION_ERROR', {
      message: error.message,
      context: (error as ValidationError).context
    })
    sendError(res, error.message, 400, { context: (error as ValidationError).context })
    return
  }

  // BusinessRuleError - Business rule violation
  if (error instanceof BusinessRuleError) {
    logError('BUSINESS_RULE_VIOLATION', {
      message: error.message,
      context: (error as BusinessRuleError).context
    })
    sendError(res, error.message, 422)
    return
  }

  // PermissionError - Access denied
  if (error instanceof PermissionError) {
    logError('PERMISSION_DENIED', {
      message: error.message,
      context: (error as PermissionError).context
    })
    sendError(res, error.message, 403)
    return
  }

  // AuthenticationError - Authentication required
  if (error instanceof AuthenticationError) {
    logError('AUTHENTICATION_ERROR', {
      message: error.message,
      context: (error as AuthenticationError).context
    })
    sendError(res, error.message, 401)
    return
  }

  // DatabaseError - Database operation failed
  if (error instanceof DatabaseError) {
    logError((error as DatabaseError).code || 'DATABASE_ERROR', {
      message: error.message,
      cause: (error as DatabaseError).cause?.message,
      context: (error as DatabaseError).context
    })
    sendError(res, error.message, 500)
    return
  }

  // ==========================================================================
  // GENERIC AppError (catch-all for base AppError)
  // ==========================================================================
  
  if (error instanceof AppError) {
    const appError = error as AppError
    logError(appError.code, {
      message: appError.message,
      context: appError.context,
      cause: appError.cause?.message
    })
    sendError(res, appError.message, appError.statusCode, { context: appError.context })
    return
  }

  // ==========================================================================
  // MODULE-SPECIFIC ERRORS - Dynamic loading via ErrorRegistry
  // ==========================================================================

  if (error instanceof Error) {
    const errorName = error.name
    
    // Identify error using registry
    const identifiedErrors = await identifyError(error)
    
    if (identifiedErrors.length > 0) {
      // Found in registry - get config
      const config = Object.values(ERROR_REGISTRY).find(c => c.name === identifiedErrors[0])
      
      if (config) {
        const category = getErrorCategoryByName(config.name)
        
        logError(config.name, {
          message: error.message,
          category: config.category,
          module: config.name
        })
        
        // Send response with module-specific status code
        sendError(res, error.message, config.defaultStatusCode, {
          code: config.name,
          category: config.category
        })
        return
      }
    }

    // Check specific known error names (for performance)
    const knownErrorChecks = [
      'BankStatementImportError',
      'FiscalPeriodError',
      'AccountingPurposeError',
      'AccountingPurposeAccountError',
      'ChartOfAccountError',
      'PricelistError',
      'PricelistNotFoundError',
      'SupplierProductError',
      'SupplierError',
      'BranchError',
      'CompanyError',
      'ProductError',
      'CategoryError',
      'SubCategoryError',
      'PaymentTermError',
      'PaymentMethodError',
      'BankError',
      'BankAccountError',
      'JobError',
      'PosImportError',
      'AggregatedTransactionError',
      'PermissionsError',
      'UserError',
      'EmployeeBranchError',
      'ProductUomError',
      'MetricUnitError',
      'ReconciliationError'
    ]

    for (const errorTypeName of knownErrorChecks) {
      if (await isModuleError(error, errorTypeName)) {
        const config = Object.values(ERROR_REGISTRY).find(c => c.name === errorTypeName)
        if (config) {
          logError(errorTypeName, { message: error.message })
          sendError(res, error.message, config.defaultStatusCode, {
            code: errorTypeName,
            category: config.category
          })
          return
        }
      }
    }
  }

  // ==========================================================================
  // OTHER ERROR TYPES
  // ==========================================================================

  // Zod validation error
  if (error instanceof ZodError) {
    const zodError = error as ZodError
    const errorMessages = zodError.issues.map((issue) => 
      `${issue.path.join('.')}: ${issue.message}`
    ).join(', ')
    
    logError('ZOD_VALIDATION_ERROR', { issues: zodError.issues })
    sendError(res, errorMessages, 400)
    return
  }

  // Generic Error
  if (error instanceof Error) {
    logError('UNEXPECTED_ERROR', { 
      message: error.message, 
      stack: error.stack 
    })
    sendError(res, 'Internal server error', 500)
    return
  }

  // Truly unknown
  logError('UNKNOWN_ERROR', { error })
  sendError(res, 'Internal server error', 500)
}

/**
 * Synchronous error handler wrapper
 * Use this when async is not needed (for backward compatibility)
 */
export const handleErrorSync = (res: Response, error: unknown): void => {
  // For sync handling, we only handle base error classes
  // Module-specific errors require async loading
  
  if (error instanceof NotFoundError) {
    sendError(res, error.message, 404)
    return
  }

  if (error instanceof ConflictError) {
    sendError(res, error.message, 409)
    return
  }

  if (error instanceof ValidationError) {
    sendError(res, error.message, 400, { context: (error as ValidationError).context })
    return
  }

  if (error instanceof BusinessRuleError) {
    sendError(res, error.message, 422)
    return
  }

  if (error instanceof PermissionError) {
    sendError(res, error.message, 403)
    return
  }

  if (error instanceof AuthenticationError) {
    sendError(res, error.message, 401)
    return
  }

  if (error instanceof DatabaseError) {
    sendError(res, error.message, 500)
    return
  }

  if (error instanceof AppError) {
    sendError(res, error.message, (error as AppError).statusCode)
    return
  }

  if (error instanceof ZodError) {
    const zodError = error as ZodError
    const errorMessages = zodError.issues.map((issue) => 
      `${issue.path.join('.')}: ${issue.message}`
    ).join(', ')
    sendError(res, errorMessages, 400)
    return
  }

  if (error instanceof Error) {
    logError('UNEXPECTED_ERROR', { message: error.message, stack: error.stack })
    sendError(res, 'Internal server error', 500)
    return
  }

  sendError(res, 'Internal server error', 500)
}
