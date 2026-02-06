/**
 * Error Transformer Utility
 * Layer untuk transformasi error ke response format secara terpusat
 * 
 * Features:
 * - Handle berbagai jenis error (ZodError, BaseError, generic Error)
 * - PostgreSQL error pattern matching
 * - User-friendly message generation
 * - Consistent response format
 */

import { ZodError } from '@/lib/openapi'
import { AppError, ErrorCategory, ErrorResponse } from './errors.base'
import { matchErrorPattern, ErrorPattern } from '../config/error-patterns.config'

// ============================================================================
// ERROR TRANSFORMER CLASS
// ============================================================================

export class ErrorTransformer {
  /**
   * Transform error ke response format
   */
  static toResponse(error: unknown): ErrorResponse {
    // Zod validation errors
    if (error instanceof ZodError) {
      return this.handleZodError(error)
    }

    // BaseError (AppError subclasses)
    if (error instanceof AppError) {
      return error.toResponse()
    }

    // Generic Error dengan known patterns
    if (error instanceof Error) {
      return this.handleGenericError(error)
    }

    // Unknown error types
    return this.handleUnknownError()
  }

  /**
   * Handle Zod validation errors
   */
  private static handleZodError(error: ZodError): ErrorResponse {
    const issues = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }))

    return {
      message: 'Validation failed',
      statusCode: 400,
      code: 'ZOD_VALIDATION_ERROR',
      category: ErrorCategory.VALIDATION,
      details: {
        issues,
        totalIssues: issues.length,
      },
    }
  }

  /**
   * Handle generic Error dengan pattern matching
   */
  private static handleGenericError(error: Error): ErrorResponse {
    // Check PostgreSQL error patterns first
    const pgPattern = matchErrorPattern(error)
    if (pgPattern) {
      return {
        message: pgPattern.message,
        statusCode: pgPattern.statusCode,
        code: pgPattern.code,
        category: pgPattern.category,
        details: {
          originalError: error.message,
        },
      }
    }

    // Check error.message untuk known patterns
    const message = error.message.toLowerCase()

    // Database errors
    if (message.includes('database') || message.includes('connection')) {
      return {
        message: 'Unable to process your request. Please try again',
        statusCode: 500,
        code: 'DATABASE_ERROR',
        category: ErrorCategory.DATABASE,
      }
    }

    // Permission errors
    if (message.includes('permission') || message.includes('access denied') || message.includes('forbidden')) {
      return {
        message: 'You do not have permission to perform this action',
        statusCode: 403,
        code: 'PERMISSION_DENIED',
        category: ErrorCategory.PERMISSION,
      }
    }

    // Not found
    if (message.includes('not found') || message.includes('does not exist')) {
      return {
        message: 'The requested resource was not found',
        statusCode: 404,
        code: 'NOT_FOUND',
        category: ErrorCategory.NOT_FOUND,
      }
    }

    // Conflict/Duplicate
    if (message.includes('already exists') || message.includes('duplicate')) {
      return {
        message: 'This record already exists',
        statusCode: 409,
        code: 'CONFLICT',
        category: ErrorCategory.CONFLICT,
      }
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('jwt') || message.includes('token')) {
      return {
        message: 'Authentication required',
        statusCode: 401,
        code: 'UNAUTHORIZED',
        category: ErrorCategory.AUTHENTICATION,
      }
    }

    // Validation errors
    if (message.includes('invalid') || message.includes('validation')) {
      return {
        message: error.message,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        category: ErrorCategory.VALIDATION,
      }
    }

    // Fallback: unknown error
    return {
      message: 'An unexpected error occurred',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      category: ErrorCategory.SYSTEM,
      details: process.env.NODE_ENV === 'development' 
        ? { originalError: error.message, stack: error.stack }
        : undefined,
    }
  }

  /**
   * Handle unknown error types
   */
  private static handleUnknownError(): ErrorResponse {
    return {
      message: 'An unexpected error occurred',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      category: ErrorCategory.SYSTEM,
    }
  }

  /**
   * Get user-friendly message dari error
   */
  static getUserMessage(error: unknown): string {
    if (error instanceof AppError) {
      // Prioritas: userMessage dari context
      if (error.context?.userMessage && typeof error.context.userMessage === 'string') {
        return error.context.userMessage
      }
      return error.message
    }

    const response = this.toResponse(error)
    return response.message
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof AppError) {
      // External service errors are retryable by default
      if (error.category === ErrorCategory.EXTERNAL_SERVICE) {
        return true
      }

      // Database errors are usually retryable
      if (error.category === ErrorCategory.DATABASE) {
        return true
      }

      // Check specific error codes
      const nonRetryableCodes = [
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'CONFLICT',
        'PERMISSION_DENIED',
        'AUTHENTICATION_ERROR',
      ]

      return !nonRetryableCodes.includes(error.code)
    }

    return false
  }

  /**
   * Get HTTP status code dari error
   */
  static getStatusCode(error: unknown): number {
    if (error instanceof AppError) {
      return error.statusCode
    }

    const response = this.toResponse(error)
    return response.statusCode
  }

  /**
   * Get error category dari error
   */
  static getCategory(error: unknown): ErrorCategory {
    if (error instanceof AppError) {
      return error.category
    }

    return ErrorCategory.SYSTEM
  }

  /**
   * Get error code dari error
   */
  static getCode(error: unknown): string {
    if (error instanceof AppError) {
      return error.code
    }

    const response = this.toResponse(error)
    return response.code
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Transform error ke response format
 */
export function transformError(error: unknown): ErrorResponse {
  return ErrorTransformer.toResponse(error)
}

/**
 * Get user-friendly message
 */
export function getUserFriendlyMessage(error: unknown): string {
  return ErrorTransformer.getUserMessage(error)
}

/**
 * Check if error is retryable
 */
export function isErrorRetryable(error: unknown): boolean {
  return ErrorTransformer.isRetryable(error)
}

/**
 * Get status code dari error
 */
export function getErrorStatusCode(error: unknown): number {
  return ErrorTransformer.getStatusCode(error)
}

/**
 * Get error category
 */
export function getErrorCategory(error: unknown): ErrorCategory {
  return ErrorTransformer.getCategory(error)
}

/**
 * Get error code
 */
export function getErrorCode(error: unknown): string {
  return ErrorTransformer.getCode(error)
}

