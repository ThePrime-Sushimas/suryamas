import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response.util'
import { logError } from '../config/logger'
import { ZodError } from 'zod'
import { EmployeeBranchError } from '../modules/employee_branches/employee_branches.errors'
import { BranchError } from '../modules/branches/branches.errors'

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

  // Custom module errors
  if (err instanceof EmployeeBranchError || err instanceof BranchError) {
    logError(`${err.name}`, { code: err.code, message: err.message, method: req.method, path: req.path })
    return sendError(res, err.message, err.statusCode)
  }

  // PostgreSQL errors from Supabase
  if ((err as any).code) {
    const pgError = err as any
    if (pgError.code === '23505') { // Unique violation
      logError('Database unique constraint violation', { error: pgError.message })
      return sendError(res, 'Record already exists', 409)
    }
    if (pgError.code === '23503') { // Foreign key violation
      logError('Database foreign key violation', { error: pgError.message })
      return sendError(res, 'Referenced record not found', 404)
    }
  }

  // Generic errors
  logError('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    body: req.body,
    user: (req as any).user?.id
  })
  
  sendError(res, err.message || 'Internal server error', 500)
}