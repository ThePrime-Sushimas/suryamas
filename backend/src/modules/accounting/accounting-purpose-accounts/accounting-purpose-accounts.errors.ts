/**
 * Accounting Purpose Accounts Error Classes
 * Module-specific error classes untuk accounting purpose accounts operations
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

export class AccountingPurposeAccountError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'AccountingPurposeAccountError'
    this.code = code
    this.statusCode = statusCode
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class PurposeAccountNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('purpose_account_mapping', id)
    this.name = 'PurposeAccountNotFoundError'
  }
}

export class PurposeNotFoundError extends NotFoundError {
  constructor(purposeId: string) {
    super('accounting_purpose', purposeId)
    this.name = 'PurposeNotFoundError'
  }
}

export class AccountNotFoundError extends NotFoundError {
  constructor(accountId: string) {
    super('chart_of_account', accountId)
    this.name = 'AccountNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class DuplicateMappingError extends ConflictError {
  constructor(purposeId: string, accountId: string, side: string) {
    super(
      'This account is already mapped to this purpose with the same side',
      { conflictType: 'duplicate', purposeId, accountId, side }
    )
    this.name = 'DuplicateMappingError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class AccountNotPostableError extends ValidationError {
  constructor(accountCode: string) {
    super(
      `Account '${accountCode}' is not postable and cannot be used for transactions`,
      { accountCode }
    )
    this.name = 'AccountNotPostableError'
  }
}

export class InvalidBalanceSideError extends ValidationError {
  constructor(accountType: string, normalBalance: string, side: string) {
    super(
      `${accountType} accounts with ${normalBalance} normal balance cannot be mapped to ${side} side`,
      { accountType, normalBalance, side }
    )
    this.name = 'InvalidBalanceSideError'
  }
}

export class PurposeAccountValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'PurposeAccountValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class PurposeAccountInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Purpose account mapping cannot be deleted as it is being used by ${usageCount} transactions`,
      { rule: 'purpose_account_in_use', mappingId: id, usageCount }
    )
    this.name = 'PurposeAccountInUseError'
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

export class PurposeAccountCreateFailedError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to create purpose account mapping',
      { code: 'PURPOSE_ACCOUNT_CREATE_FAILED', context: { error } }
    )
    this.name = 'PurposeAccountCreateFailedError'
  }
}

export class PurposeAccountUpdateFailedError extends DatabaseError {
  constructor(id: string, error?: string) {
    super(
      `Failed to update purpose account mapping ${id}`,
      { code: 'PURPOSE_ACCOUNT_UPDATE_FAILED', context: { id, error } }
    )
    this.name = 'PurposeAccountUpdateFailedError'
  }
}

export class PurposeAccountDeleteFailedError extends DatabaseError {
  constructor(id: string, error?: string) {
    super(
      `Failed to delete purpose account mapping ${id}`,
      { code: 'PURPOSE_ACCOUNT_DELETE_FAILED', context: { id, error } }
    )
    this.name = 'PurposeAccountDeleteFailedError'
  }
}

export class BulkOperationFailedError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Bulk ${operation} operation failed`,
      { code: 'BULK_OPERATION_FAILED', context: { operation, error } }
    )
    this.name = 'BulkOperationFailedError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const AccountingPurposeAccountErrors = {
  NOT_FOUND: (id?: string) => new PurposeAccountNotFoundError(id),
  PURPOSE_NOT_FOUND: (purposeId: string) => new PurposeNotFoundError(purposeId),
  ACCOUNT_NOT_FOUND: (accountId: string) => new AccountNotFoundError(accountId),
  ACCOUNT_NOT_POSTABLE: (accountCode: string) => new AccountNotPostableError(accountCode),
  DUPLICATE_MAPPING: (purposeId: string, accountId: string, side: string) => 
    new DuplicateMappingError(purposeId, accountId, side),
  INVALID_BALANCE_SIDE: (accountType: string, normalBalance: string, side: string) => 
    new InvalidBalanceSideError(accountType, normalBalance, side),
  COMPANY_ACCESS_DENIED: (companyId: string) => new CompanyAccessDeniedError(companyId),
  CREATE_FAILED: (error?: string) => new PurposeAccountCreateFailedError(error),
  UPDATE_FAILED: (id?: string, error?: string) => new PurposeAccountUpdateFailedError(id || 'unknown', error),
  DELETE_FAILED: (id: string, error?: string) => new PurposeAccountDeleteFailedError(id, error),
  BULK_OPERATION_FAILED: (operation: string, error?: string) => new BulkOperationFailedError(operation, error),
}
