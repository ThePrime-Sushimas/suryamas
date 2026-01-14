import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response.util'
import { logError } from '../config/logger'
import { ZodError } from '@/lib/openapi'
import { EmployeeBranchError } from '../modules/employee_branches/employee_branches.errors'
import { BranchError } from '../modules/branches/branches.errors'
import { CompanyError } from '../modules/companies/companies.errors'
import { ProductError } from '../modules/products/products.errors'

/**
 * Convert technical error messages to user-friendly messages
 */
function getUserFriendlyMessage(error: any): string {
  const message = error?.message || String(error)
  const lowerMessage = message.toLowerCase()
  
  // Database errors
  if (lowerMessage.includes('database query failed') || lowerMessage.includes('database error')) {
    return 'Unable to process your request. Please try again'
  }
  
  if (lowerMessage.includes('database insert failed')) {
    return 'Failed to create record. Please try again'
  }
  
  if (lowerMessage.includes('database update failed')) {
    return 'Failed to update record. Please try again'
  }
  
  if (lowerMessage.includes('database delete failed') || lowerMessage.includes('database bulk delete failed')) {
    return 'Failed to delete record. Please try again'
  }
  
  if (lowerMessage.includes('database restore failed') || lowerMessage.includes('database bulk restore failed')) {
    return 'Failed to restore record. Please try again'
  }
  
  if (lowerMessage.includes('count query failed')) {
    return 'Unable to load data. Please try again'
  }
  
  // Connection errors
  if (lowerMessage.includes('connect') || lowerMessage.includes('connection')) {
    return 'Connection error. Please try again later'
  }
  
  // Permission errors
  if (lowerMessage.includes('permission denied') || lowerMessage.includes('access denied')) {
    return 'You do not have permission to perform this action'
  }
  
  // Constraint errors
  if (lowerMessage.includes('foreign key') || lowerMessage.includes('violates foreign key constraint')) {
    return 'Cannot complete this action because related records exist'
  }
  
  if (lowerMessage.includes('unique constraint') || lowerMessage.includes('duplicate key')) {
    return 'This record already exists'
  }
  
  // Timeout
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'Request timed out. Please try again'
  }
  
  // Network
  if (lowerMessage.includes('network') || lowerMessage.includes('econnrefused')) {
    return 'Network error. Please check your connection'
  }
  
  // If message is already user-friendly (doesn't contain technical terms), keep it
  const technicalTerms = ['query', 'database', 'sql', 'postgres', 'supabase', 'rpc', 'function', 'failed:']
  const hasTechnicalTerms = technicalTerms.some(term => lowerMessage.includes(term))
  
  if (!hasTechnicalTerms) {
    return message // Keep user-friendly messages as-is
  }
  
  // Default fallback for technical errors
  return 'An error occurred. Please try again'
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    logError('Validation error', { errors, method: req.method, path: req.path })
    return sendError(res, errors, 400)
  }

  // Custom module errors (already user-friendly)
  if (err instanceof EmployeeBranchError || err instanceof BranchError || err instanceof CompanyError || err instanceof ProductError) {
    logError(`${err.name}`, { code: err.code, message: err.message, method: req.method, path: req.path })
    return sendError(res, err.message, err.statusCode)
  }

  // PostgreSQL errors from Supabase
  if ((err as any).code) {
    const pgError = err as any
    if (pgError.code === '23505') { // Unique violation
      logError('Database unique constraint violation', { error: pgError.message })
      return sendError(res, 'This record already exists', 409)
    }
    if (pgError.code === '23503') { // Foreign key violation
      logError('Database foreign key violation', { error: pgError.message })
      return sendError(res, 'Cannot complete this action because related records exist', 404)
    }
  }

  // Generic errors - convert technical to user-friendly
  logError('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    body: req.body,
    user: (req as any).user?.id
  })
  
  const userMessage = getUserFriendlyMessage(err)
  sendError(res, userMessage, 500)
}