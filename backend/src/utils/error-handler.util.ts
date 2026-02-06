import { Response } from 'express'
import { ZodError } from '@/lib/openapi'
import { sendError } from './response.util'
import { logError } from '../config/logger'

// Import base error classes first (before any type checks)
import {
  AppError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError
} from './errors.base'

// Import module-specific errors (after base classes to avoid circular dependencies)
import { SupplierProductError } from '../modules/supplier-products/supplier-products.errors'
import { ChartOfAccountError } from '../modules/accounting/chart-of-accounts/chart-of-accounts.errors'
import { AccountingPurposeError } from '../modules/accounting/accounting-purposes/accounting-purposes.errors'
import { FiscalPeriodError } from '../modules/accounting/fiscal-periods/fiscal-periods.errors'
import { CompanyError } from '../modules/companies/companies.errors'
import { 
  PricelistNotFoundError, 
  DuplicateActivePricelistError, 
  InvalidDateRangeError,
  PricelistNotDraftError,
  DuplicateRestoreError
} from '../modules/pricelists/pricelists.errors'
import { BankStatementImportError } from '../modules/reconciliation/bank-statement-import/bank-statement-import.errors'

// Re-export base error classes for convenience
export {
  AppError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BusinessRuleError
}

export const handleError = (res: Response, error: unknown): void => {
  // Bank Statement Import custom errors
  if (error instanceof BankStatementImportError) {
    logError(error.code, {
      message: error.message,
      context: error.context,
      cause: error.cause?.message
    })
    // Send error with context for frontend user-friendly messages
    sendError(res, error.message, error.statusCode, { context: error.context, code: error.code })
    return
  }

  // Fiscal Periods custom errors
  if (error instanceof FiscalPeriodError) {
    logError(error.code, { message: error.message })
    sendError(res, error.message, error.statusCode)
    return
  }

  // Accounting Purposes custom errors
  if (error instanceof AccountingPurposeError) {
    logError(error.code, { message: error.message })
    sendError(res, error.message, error.statusCode)
    return
  }

  // Chart of Accounts custom errors
  if (error instanceof ChartOfAccountError) {
    logError(error.code, { message: error.message })
    sendError(res, error.message, error.statusCode)
    return
  }

  // Company custom errors
  if (error instanceof CompanyError) {
    logError(error.code, { message: error.message })
    sendError(res, error.message, error.statusCode)
    return
  }

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
      details: (error as any).details
    })
    sendError(res, error.message, (error as any).statusCode)
    return
  }

  // Custom AppError with full context
  if (error instanceof AppError) {
    const appError = error as AppError
    logError(appError.code, {
      message: appError.message,
      context: appError.context,
      cause: appError.cause?.message
    })
    // Send error with context for frontend user-friendly messages
    sendError(res, appError.message, appError.statusCode, { context: appError.context })
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

