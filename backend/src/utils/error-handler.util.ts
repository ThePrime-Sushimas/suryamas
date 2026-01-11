import { Response } from 'express'
import { ZodError } from '@/lib/openapi'
import { sendError } from './response.util'
import { logError } from '../config/logger'
import { SupplierProductError } from '../modules/supplier-products/supplier-products.errors'
import { 
  PricelistNotFoundError, 
  DuplicateActivePricelistError, 
  InvalidDateRangeError,
  PricelistNotDraftError,
  DuplicateRestoreError
} from '../modules/pricelists/pricelists.errors'

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly context?: any,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, options?: { cause?: Error; context?: any }) {
    super(message, 500, 'DATABASE_ERROR', options?.context, options?.cause)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: any) {
    super(message, 400, 'VALIDATION_ERROR', context)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, context?: any) {
    super(message, 404, 'NOT_FOUND', context)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, context?: any) {
    super(message, 409, 'CONFLICT', context)
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, context?: any) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION', context)
  }
}

export const handleError = (res: Response, error: unknown): void => {
  // Pricelist custom errors
  if (error instanceof PricelistNotFoundError || 
      error instanceof DuplicateActivePricelistError ||
      error instanceof InvalidDateRangeError ||
      error instanceof PricelistNotDraftError ||
      error instanceof DuplicateRestoreError) {
    logError(error.name, { message: error.message })
    sendError(res, error.message, (error as any).statusCode)
    return
  }

  // SupplierProduct custom errors
  if (error instanceof SupplierProductError) {
    logError(error.code, {
      message: error.message,
      details: error.details
    })
    sendError(res, error.message, error.statusCode)
    return
  }

  // Custom AppError with full context
  if (error instanceof AppError) {
    logError(error.code, {
      message: error.message,
      context: error.context,
      cause: error.cause?.message
    })
    sendError(res, error.message, error.statusCode)
    return
  }

  // Zod validation error
  if (error instanceof ZodError) {
    sendError(
      res,
      error.issues[0]?.message || 'Invalid input',
      400
    )
    return
  }

  // Generic error
  if (error instanceof Error) {
    logError('UNEXPECTED_ERROR', { message: error.message, stack: error.stack })
    sendError(res, 'Internal server error', 500)
    return
  }

  // Truly unknown
  logError('UNKNOWN_ERROR', { error })
  sendError(res, 'Internal server error', 500)
}
