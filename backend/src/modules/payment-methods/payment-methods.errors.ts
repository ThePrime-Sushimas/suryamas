/**
 * Payment Methods Error Classes
 * Module-specific error classes untuk payment methods operations
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
  PermissionError,
  DatabaseError
} from '../../utils/errors.base'

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class PaymentMethodError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'PaymentMethodError'
    this.code = code
    this.statusCode = statusCode
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class PaymentMethodNotFoundError extends NotFoundError {
  constructor(id?: number | string) {
    super('payment_method', id)
    this.name = 'PaymentMethodNotFoundError'
  }
}

export class CompanyNotFoundError extends NotFoundError {
  constructor(companyId: string) {
    super('company', companyId)
    this.name = 'CompanyNotFoundError'
  }
}

export class BankAccountNotFoundError extends NotFoundError {
  constructor(bankAccountId: number) {
    super('bank_account', bankAccountId)
    this.name = 'BankAccountNotFoundError'
  }
}

export class CoaAccountNotFoundError extends NotFoundError {
  constructor(coaAccountId: string) {
    super('chart_of_account', coaAccountId)
    this.name = 'CoaAccountNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class PaymentMethodCodeExistsError extends ConflictError {
  constructor(code: string, companyId: string) {
    super(
      `Payment method code '${code}' already exists in this company`,
      { conflictType: 'duplicate', code, companyId }
    )
    this.name = 'PaymentMethodCodeExistsError'
  }
}

export class OnlyOneDefaultAllowedError extends ConflictError {
  constructor(companyId: string) {
    super(
      'Only one default payment method is allowed per company',
      { conflictType: 'duplicate', companyId }
    )
    this.name = 'OnlyOneDefaultAllowedError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidPaymentTypeError extends ValidationError {
  constructor(paymentType: string, validTypes: string[]) {
    super(
      `Invalid payment type: ${paymentType}`,
      { paymentType, validTypes }
    )
    this.name = 'InvalidPaymentTypeError'
  }
}

export class CoaNotPostableError extends ValidationError {
  constructor(coaCode: string) {
    super(
      `Chart of account '${coaCode}' is not postable`,
      { coaCode }
    )
    this.name = 'CoaNotPostableError'
  }
}

export class PaymentMethodValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'PaymentMethodValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class BankAccountInactiveError extends BusinessRuleError {
  constructor(bankAccountId: number) {
    super(
      `Bank account ${bankAccountId} is not active`,
      { rule: 'bank_account_active', bankAccountId }
    )
    this.name = 'BankAccountInactiveError'
  }
}

export class CannotDeleteDefaultPaymentMethodError extends BusinessRuleError {
  constructor(id: number) {
    super(
      'Cannot delete default payment method',
      { rule: 'default_payment_method_deletion', paymentMethodId: id }
    )
    this.name = 'CannotDeleteDefaultPaymentMethodError'
  }
}

export class CannotDeactivateDefaultPaymentMethodError extends BusinessRuleError {
  constructor(id: number) {
    super(
      'Cannot deactivate default payment method',
      { rule: 'default_payment_method_deactivation', paymentMethodId: id }
    )
    this.name = 'CannotDeactivateDefaultPaymentMethodError'
  }
}

export class PaymentMethodInUseError extends BusinessRuleError {
  constructor(id: number, usageCount: number) {
    super(
      `Payment method cannot be deleted as it is being used by ${usageCount} transactions`,
      { rule: 'payment_method_in_use', paymentMethodId: id, usageCount }
    )
    this.name = 'PaymentMethodInUseError'
  }
}

// ============================================================================
// PERMISSION ERRORS
// ============================================================================

export class CompanyAccessDeniedError extends PermissionError {
  constructor(companyId: string) {
    super(
      'You do not have permission to access this company data',
      { permission: 'company_access', resource: 'company', resourceId: companyId }
    )
    this.name = 'CompanyAccessDeniedError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class PaymentMethodCreateFailedError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to create payment method',
      { code: 'PAYMENT_METHOD_CREATE_FAILED', context: { error } }
    )
    this.name = 'PaymentMethodCreateFailedError'
  }
}

export class PaymentMethodUpdateFailedError extends DatabaseError {
  constructor(id?: number, error?: string) {
    super(
      `Failed to update payment method ${id || 'unknown'}`,
      { code: 'PAYMENT_METHOD_UPDATE_FAILED', context: { id, error } }
    )
    this.name = 'PaymentMethodUpdateFailedError'
  }
}

export class PaymentMethodDeleteFailedError extends DatabaseError {
  constructor(id: number, error?: string) {
    super(
      `Failed to delete payment method ${id}`,
      { code: 'PAYMENT_METHOD_DELETE_FAILED', context: { id, error } }
    )
    this.name = 'PaymentMethodDeleteFailedError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const PaymentMethodErrors = {
  NOT_FOUND: (id?: number | string) => new PaymentMethodNotFoundError(id),
  COMPANY_NOT_FOUND: (companyId: string) => new CompanyNotFoundError(companyId),
  COMPANY_ACCESS_DENIED: (companyId: string) => new CompanyAccessDeniedError(companyId),
  BANK_ACCOUNT_NOT_FOUND: (bankAccountId: number) => new BankAccountNotFoundError(bankAccountId),
  COA_ACCOUNT_NOT_FOUND: (coaAccountId: string) => new CoaAccountNotFoundError(coaAccountId),
  COA_NOT_POSTABLE: (coaCode: string) => new CoaNotPostableError(coaCode),
  CODE_EXISTS: (code: string, companyId: string) => new PaymentMethodCodeExistsError(code, companyId),
  INVALID_PAYMENT_TYPE: (paymentType: string, validTypes: string[]) => 
    new InvalidPaymentTypeError(paymentType, validTypes),
  BANK_ACCOUNT_INACTIVE: (bankAccountId: number) => new BankAccountInactiveError(bankAccountId),
  CANNOT_DELETE_DEFAULT: (id: number) => new CannotDeleteDefaultPaymentMethodError(id),
  CANNOT_DEACTIVATE_DEFAULT: (id: number) => new CannotDeactivateDefaultPaymentMethodError(id),
  ONLY_ONE_DEFAULT_ALLOWED: (companyId: string) => new OnlyOneDefaultAllowedError(companyId),
  CREATE_FAILED: (error?: string) => new PaymentMethodCreateFailedError(error),
  UPDATE_FAILED: (id?: number, error?: string) => new PaymentMethodUpdateFailedError(id, error),
  DELETE_FAILED: (id: number, error?: string) => new PaymentMethodDeleteFailedError(id, error),
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

export const PaymentMethodsConfig = {
  PAYMENT_TYPES: [
    'BANK',
    'CARD',
    'CASH',
    'COMPLIMENT',
    'MEMBER_DEPOSIT',
    'OTHER_COST'
  ] as const,

  EXPORT: {
    MAX_ROWS: 10000,
    FILENAME_PREFIX: 'payment-methods'
  },

  VALIDATION: {
    CODE_MAX_LENGTH: 20,
    NAME_MAX_LENGTH: 100,
    DESCRIPTION_MAX_LENGTH: 500,
    MIN_SORT_ORDER: 0,
    MAX_SORT_ORDER: 9999
  },

  CACHE_TTL: 5 * 60 * 1000 // 5 minutes
}

