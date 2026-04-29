/**
 * Error Handler Middleware
 * Central error handling untuk seluruh aplikasi
 * 
 * Features:
 * - Structured error logging
 * - Error pattern matching
 * - Context enrichment
 * - User-friendly error messages
 * - ErrorTransformer integration
 */

import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response.util'
import { logError, logWarn } from '../config/logger'
import { ZodError } from '@/lib/openapi'
import { AppError } from '../utils/errors.base'
import { enrichErrorContext, logStructuredError } from '../utils/error-context.util'
import { ErrorTransformer, transformError, getUserFriendlyMessage } from '../utils/error-transformer.util'
import { isRegisteredError } from '../utils/error-registry.util'
import { monitoringRepository } from '../modules/monitoring/monitoring.repository'
import { notifyError } from '../services/webhook-notifier.service'
import type { AuthRequest } from '../types/common.types'

function persistError(err: Error, req: Request, statusCode: number, severity: string, skipNotify = false): void {
  const authReq = req as AuthRequest
  const route = `${req.method} ${req.route?.path || req.path}`
  const module = req.path.split('/').filter(Boolean)[0] || 'unknown'

  monitoringRepository.createErrorReport({
    errorName: err.name || 'Error',
    errorMessage: err.message,
    errorStack: err.stack,
    errorType: (err as AppError).code || (err as any).code || 'UNEXPECTED_ERROR',
    severity,
    module,
    submodule: req.path.split('/').filter(Boolean)[1],
    userId: authReq.user?.id,
    branchId: (req as any).branchContext?.branch_id,
    url: req.originalUrl,
    route,
    userAgent: req.headers['user-agent'] || '',
    context: { statusCode, query: req.query, body: req.method !== 'GET' ? '[redacted]' : undefined },
  }).catch(e => logWarn('Failed to persist error to DB', { error: e instanceof Error ? e.message : String(e) }))

  if (!skipNotify) {
    notifyError({ severity, module, route, message: err.message, timestamp: new Date().toISOString() })
  }
}

function getSeverity(statusCode: number): string {
  if (statusCode >= 500) return 'CRITICAL'
  if (statusCode >= 400) return 'MEDIUM'
  return 'LOW'
}

/**
 * Main error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Enrich error context
  const context = enrichErrorContext(err, req)
  
  // Zod validation errors - handle separately for detailed response
  if (err instanceof ZodError) {
    const response = ErrorTransformer.toResponse(err)
    logStructuredError(err, context, response.statusCode)
    return sendError(res, response.message, response.statusCode, response.details)
  }

  // Handle errors that extend AppError (base error class)
  if (err instanceof AppError) {
    const appError = err as AppError
    const response = ErrorTransformer.toResponse(appError)
    logStructuredError(appError, context, response.statusCode)
    if (response.statusCode >= 400) persistError(appError, req, response.statusCode, getSeverity(response.statusCode), response.statusCode < 500)
    return sendError(res, response.message, response.statusCode, response.details)
  }

  // Handle module-specific errors (legacy, not extending AppError)
  // Using dynamic registry check
  isRegisteredError(err, err.name).then((isMatch) => {
    if (isMatch) {
      const response = ErrorTransformer.toResponse(err)
      logStructuredError(err, context, response.statusCode)
      if (response.statusCode >= 400) persistError(err, req, response.statusCode, getSeverity(response.statusCode), response.statusCode < 500)
      return sendError(res, response.message, response.statusCode, response.details)
    }
    
    // PostgreSQL errors and generic errors - use ErrorTransformer
    const response = transformError(err)
    
    // Log PostgreSQL code for debugging if available
    if ((err as any).code && response.category === 'database') {
      logWarn(`PostgreSQL error: ${(err as any).code}`, { 
        error: err.message,
        pgCode: (err as any).code,
        pattern: response.code
      })
    }
    
    logStructuredError(err, context, response.statusCode)
    persistError(err, req, response.statusCode, getSeverity(response.statusCode))
    
    const userMessage = getUserFriendlyMessage(err)
    sendError(res, userMessage, response.statusCode, response.details)
  })
}

/**
 * Async error handler wrapper
 * Untuk handling errors dari async/await routes
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Not found handler (404)
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const context = enrichErrorContext(new Error('Not Found'), req)
  logWarn('Route not found', {
    method: req.method,
    path: req.path,
    context
  })
  
  sendError(res, `Route ${req.method} ${req.path} not found`, 404, 'NOT_FOUND')
}

/**
 * Unhandled rejection handler
 * Untuk handling promise rejections yang tidak tercatch
 */
export const unhandledRejectionHandler = (): void => {
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    logError('Unhandled Promise Rejection', {
      message: error.message,
      stack: error.stack,
      promise: promise.toString(),
    })
    monitoringRepository.createErrorReport({
      errorName: error.name, errorMessage: error.message, errorStack: error.stack,
      errorType: 'UNHANDLED_REJECTION', severity: 'CRITICAL', module: 'system',
      url: '', route: '', userAgent: '',
    }).catch(() => {})
  })
}

/**
 * Uncaught exception handler
 * Untuk handling exceptions yang tidak tercatch
 */
export const uncaughtExceptionHandler = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logError('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    })
    monitoringRepository.createErrorReport({
      errorName: error.name, errorMessage: error.message, errorStack: error.stack,
      errorType: 'UNCAUGHT_EXCEPTION', severity: 'CRITICAL', module: 'system',
      url: '', route: '', userAgent: '',
    }).catch(() => {}).finally(() => process.exit(1))
  })
}

