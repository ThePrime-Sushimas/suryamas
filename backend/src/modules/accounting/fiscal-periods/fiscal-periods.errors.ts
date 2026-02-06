/**
 * Fiscal Periods Error Classes
 * Module-specific error classes untuk fiscal periods operations
 * 
 * Design Principles:
 * - Extend dari BaseError classes untuk konsistensi
 * - Bilingual support (Indonesian + English)
 * - Actionable error messages dengan guidance
 */

import { 
  NotFoundError, 
  ConflictError, 
  ValidationError,
  BusinessRuleError,
  DatabaseError
} from '../../../utils/errors.base'

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class FiscalPeriodError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'FiscalPeriodError'
    Error.captureStackTrace(this, this.constructor)
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class FiscalPeriodNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('fiscal_period', id)
    this.name = 'FiscalPeriodNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class FiscalPeriodExistsError extends ConflictError {
  constructor(period: string, companyId: string) {
    super(
      `Period ${period} already exists for this company`,
      { conflictType: 'duplicate', period, companyId }
    )
    this.name = 'FiscalPeriodExistsError'
  }
}

export class PeriodAlreadyClosedError extends ConflictError {
  constructor(period: string) {
    super(
      `Period ${period} is already closed`,
      { conflictType: 'status', period }
    )
    this.name = 'PeriodAlreadyClosedError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidPeriodFormatError extends ValidationError {
  constructor() {
    super(
      'Period format must be YYYY-MM (e.g., 2024-01)',
      { format: 'YYYY-MM' }
    )
    this.name = 'InvalidPeriodFormatError'
  }
}

export class InvalidDateRangeError extends ValidationError {
  constructor() {
    super(
      'Period start date must be before or equal to end date',
      { rule: 'date_range' }
    )
    this.name = 'InvalidDateRangeError'
  }
}

export class FiscalPeriodValidationError extends ValidationError {
  constructor(field: string, message: string) {
    super(message, { field })
    this.name = 'FiscalPeriodValidationError'
  }
}

export class BulkOperationLimitExceededError extends ValidationError {
  constructor(operation: string, limit: number, actual: number) {
    super(
      `Bulk ${operation} limit exceeded. Maximum: ${limit}, Requested: ${actual}`,
      { operation, limit, actual }
    )
    this.name = 'BulkOperationLimitExceededError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class CannotReopenPeriodError extends BusinessRuleError {
  constructor() {
    super(
      'Period is already closed and cannot be reopened',
      { rule: 'period_reopen' }
    )
    this.name = 'CannotReopenPeriodError'
  }
}

export class FiscalPeriodInUseError extends BusinessRuleError {
  constructor(period: string, usageCount: number) {
    super(
      `Period ${period} is being used by ${usageCount} journal entries and cannot be deleted`,
      { rule: 'period_in_use', period, usageCount }
    )
    this.name = 'FiscalPeriodInUseError'
  }
}

export class PeriodOverlapError extends BusinessRuleError {
  constructor(period: string) {
    super(
      `Period ${period} overlaps with existing period`,
      { rule: 'period_overlap', period }
    )
    this.name = 'PeriodOverlapError'
  }
}

export class CannotClosePeriodWithOpenChildError extends BusinessRuleError {
  constructor() {
    super(
      'Cannot close period with open child periods',
      { rule: 'close_with_open_children' }
    )
    this.name = 'CannotClosePeriodWithOpenChildError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class FiscalPeriodOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} fiscal period`,
      { code: `FISCAL_PERIOD_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'FiscalPeriodOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const FiscalPeriodErrors = {
  NOT_FOUND: (id: string) => new FiscalPeriodNotFoundError(id),
  PERIOD_EXISTS: (period: string, companyId: string) => new FiscalPeriodExistsError(period, companyId),
  INVALID_PERIOD_FORMAT: () => new InvalidPeriodFormatError(),
  INVALID_DATE_RANGE: () => new InvalidDateRangeError(),
  PERIOD_ALREADY_CLOSED: (period?: string) => new PeriodAlreadyClosedError(period || 'unknown'),
  CANNOT_REOPEN_PERIOD: () => new CannotReopenPeriodError(),
  PERIOD_IN_USE: (period: string, usageCount?: number) => new FiscalPeriodInUseError(period, usageCount || 0),
  VALIDATION_ERROR: (field: string, message: string) => new FiscalPeriodValidationError(field, message),
  BULK_OPERATION_LIMIT_EXCEEDED: (operation: string, limit: number, actual: number) => 
    new BulkOperationLimitExceededError(operation, limit, actual),
  REPOSITORY_ERROR: (operation: string, error?: string) => new FiscalPeriodOperationError(operation, error),
}

