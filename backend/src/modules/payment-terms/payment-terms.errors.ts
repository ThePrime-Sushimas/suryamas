/**
 * Payment Terms Error Classes
 * Module-specific error classes untuk payment terms operations
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
  BusinessRuleError
} from '../../utils/errors.base'

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class PaymentTermError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class PaymentTermNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('payment_term', id)
    this.name = 'PaymentTermNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class DuplicateTermCodeError extends ConflictError {
  constructor(code: string) {
    super(
      `Payment term with code '${code}' already exists`,
      { conflictType: 'duplicate', termCode: code }
    )
    this.name = 'DuplicateTermCodeError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidCalculationTypeError extends ValidationError {
  constructor(type: string, validTypes: string[]) {
    super(
      `Invalid calculation type '${type}'`,
      { calculationType: type, validTypes }
    )
    this.name = 'InvalidCalculationTypeError'
  }
}

export class PaymentTermValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'PaymentTermValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class TermCodeUpdateError extends BusinessRuleError {
  constructor() {
    super(
      'Term code cannot be updated',
      { rule: 'term_code_immutable' }
    )
    this.name = 'TermCodeUpdateError'
  }
}

export class PaymentTermInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Payment term cannot be deleted as it is being used by ${usageCount} records`,
      { rule: 'term_in_use', termId: id, usageCount }
    )
    this.name = 'PaymentTermInUseError'
  }
}

export class CannotDeleteDefaultTermError extends BusinessRuleError {
  constructor(termName: string) {
    super(
      `Cannot delete default payment term '${termName}'`,
      { rule: 'default_term_deletion', termName }
    )
    this.name = 'CannotDeleteDefaultTermError'
  }
}

export class InvalidTermValueError extends ValidationError {
  constructor(field: string, value: number, constraints?: { min?: number; max?: number }) {
    let message = `Invalid ${field} value: ${value}`
    if (constraints?.min !== undefined) message += `. Minimum value is ${constraints.min}`
    if (constraints?.max !== undefined) message += `. Maximum value is ${constraints.max}`
    
    super(message, { field, value, ...constraints })
    this.name = 'InvalidTermValueError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const PaymentTermErrors = {
  NOT_FOUND: (id: string) => new PaymentTermNotFoundError(id),
  DUPLICATE_CODE: (code: string) => new DuplicateTermCodeError(code),
  INVALID_CALCULATION_TYPE: (type: string, validTypes: string[]) => 
    new InvalidCalculationTypeError(type, validTypes),
  TERM_CODE_UPDATE_FORBIDDEN: () => new TermCodeUpdateError(),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new PaymentTermValidationError(message, details),
  DEFAULT_DELETE_FORBIDDEN: (termName: string) => 
    new CannotDeleteDefaultTermError(termName),
  INVALID_VALUE: (field: string, value: number, constraints?: { min?: number; max?: number }) => 
    new InvalidTermValueError(field, value, constraints),
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

export const PaymentTermsConfig = {
  VALID_CALCULATION_TYPES: ['days', 'date', 'end_of_month'] as const,
  
  VALIDATION: {
    CODE_MAX_LENGTH: 20,
    NAME_MAX_LENGTH: 100,
    DESCRIPTION_MAX_LENGTH: 500,
    MIN_DAYS: 0,
    MAX_DAYS: 365,
    MIN_DISCOUNT_DAYS: 0,
    MAX_DISCOUNT_DAYS: 365,
  },
  
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
}
