/**
 * Accounting Purposes Error Classes
 * Module-specific error classes untuk accounting purposes operations
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
} from '../../../utils/errors.base'

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class AccountingPurposeError extends Error {
  constructor(
    message: string, 
    public statusCode: number = 400, 
    public code: string = 'ACCOUNTING_PURPOSE_ERROR',
    public category: 'CLIENT_ERROR' | 'SERVER_ERROR' = 'CLIENT_ERROR',
    public cause?: Error
  ) {
    super(message)
    this.name = 'AccountingPurposeError'
    Error.captureStackTrace(this, this.constructor)
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class AccountingPurposeNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('accounting_purpose', id)
    this.name = 'AccountingPurposeNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class PurposeCodeExistsError extends ConflictError {
  constructor(code: string, companyId: string) {
    super(
      `Purpose code '${code}' already exists in this company`,
      { conflictType: 'duplicate', code, companyId }
    )
    this.name = 'PurposeCodeExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidAppliedToError extends ValidationError {
  constructor(appliedTo: string, validValues: string[]) {
    super(
      `Invalid applied_to value: ${appliedTo}. Must be one of: ${validValues.join(', ')}`,
      { appliedTo, validValues }
    )
    this.name = 'InvalidAppliedToError'
  }
}

export class PurposeValidationError extends ValidationError {
  constructor(field: string, message: string) {
    super(message, { field })
    this.name = 'PurposeValidationError'
  }
}

export class BulkOperationLimitExceededError extends ValidationError {
  constructor(operation: string, limit: number, actual: number) {
    super(
      `Bulk ${operation} operation limit exceeded. Maximum allowed: ${limit}, requested: ${actual}`,
      { operation, limit, actual }
    )
    this.name = 'BulkOperationLimitExceededError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class SystemPurposeReadonlyError extends BusinessRuleError {
  constructor() {
    super(
      'System purposes are read-only and cannot be modified or deleted',
      { rule: 'system_purpose_readonly' }
    )
    this.name = 'SystemPurposeReadonlyError'
  }
}

export class PurposeInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Accounting purpose cannot be deleted as it is being used by ${usageCount} transactions`,
      { rule: 'purpose_in_use', purposeId: id, usageCount }
    )
    this.name = 'PurposeInUseError'
  }
}

// ============================================================================
// PERMISSION ERRORS
// ============================================================================

export class CompanyAccessDeniedError extends PermissionError {
  constructor(companyId: string) {
    super(
      `Access denied to company ${companyId}`,
      { permission: 'company_access', resource: 'company', resourceId: companyId }
    )
    this.name = 'CompanyAccessDeniedError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class PurposeCreateFailedError extends DatabaseError {
  constructor(cause?: Error) {
    super(
      'Failed to create accounting purpose',
      { code: 'PURPOSE_CREATE_FAILED', cause }
    )
    this.name = 'PurposeCreateFailedError'
  }
}

export class PurposeUpdateFailedError extends DatabaseError {
  constructor(cause?: Error) {
    super(
      'Failed to update accounting purpose',
      { code: 'PURPOSE_UPDATE_FAILED', cause }
    )
    this.name = 'PurposeUpdateFailedError'
  }
}

export class PurposeDeleteFailedError extends DatabaseError {
  constructor(cause?: Error) {
    super(
      'Failed to delete accounting purpose',
      { code: 'PURPOSE_DELETE_FAILED', cause }
    )
    this.name = 'PurposeDeleteFailedError'
  }
}

export class PurposeRepositoryError extends DatabaseError {
  constructor(operation: string, cause?: Error) {
    super(
      `Database operation '${operation}' failed`,
      { code: 'PURPOSE_REPOSITORY_ERROR', context: { operation }, cause }
    )
    this.name = 'PurposeRepositoryError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const AccountingPurposeErrors = {
  NOT_FOUND: (id: string) => new AccountingPurposeNotFoundError(id),
  CODE_EXISTS: (code: string, companyId: string) => new PurposeCodeExistsError(code, companyId),
  SYSTEM_PURPOSE_READONLY: () => new SystemPurposeReadonlyError(),
  COMPANY_ACCESS_DENIED: (companyId: string) => new CompanyAccessDeniedError(companyId),
  INVALID_APPLIED_TO: (appliedTo: string, _validValues?: string[]) => 
    new InvalidAppliedToError(appliedTo, _validValues || []),
  CREATE_FAILED: (cause?: Error) => new PurposeCreateFailedError(cause),
  UPDATE_FAILED: (cause?: Error) => new PurposeUpdateFailedError(cause),
  REPOSITORY_ERROR: (operation: string, cause?: Error) => new PurposeRepositoryError(operation, cause),
  VALIDATION_ERROR: (field: string, message: string) => new PurposeValidationError(field, message),
  BULK_OPERATION_LIMIT_EXCEEDED: (operation: string, limit: number, actual: number) => 
    new BulkOperationLimitExceededError(operation, limit, actual),
}

