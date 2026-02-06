/**
 * Chart of Accounts Error Classes
 * Module-specific error classes untuk chart of accounts operations
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

export class ChartOfAccountError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message)
    this.name = 'ChartOfAccountError'
    this.code = code
    this.statusCode = statusCode
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class AccountNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('chart_of_account', id)
    this.name = 'AccountNotFoundError'
  }
}

export class ParentAccountNotFoundError extends NotFoundError {
  constructor(parentId: string) {
    super('parent_account', parentId)
    this.name = 'ParentAccountNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class AccountCodeExistsError extends ConflictError {
  constructor(code: string, companyId?: string) {
    super(
      `Account code '${code}' already exists`,
      { conflictType: 'duplicate', code, companyId }
    )
    this.name = 'AccountCodeExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidParentAccountError extends ValidationError {
  constructor(parentId: string, reason: string) {
    let message = 'Invalid parent account selected'
    
    if (reason === 'Parent account not found') {
      message = 'Selected parent account is not available'
    } else if (reason === 'Cannot set self as parent') {
      message = 'An account cannot be its own parent'
    } else if (reason === 'Circular reference detected') {
      message = 'This would create a circular reference in the account hierarchy'
    }
    
    super(message, { parentId, reason })
    this.name = 'InvalidParentAccountError'
  }
}

export class ParentCompanyMismatchError extends ValidationError {
  constructor(parentCompany: string, childCompany: string) {
    super(
      'The selected parent account belongs to a different company',
      { parentCompany, childCompany }
    )
    this.name = 'ParentCompanyMismatchError'
  }
}

export class ParentMustBeHeaderError extends ValidationError {
  constructor(parentCode?: string) {
    super(
      'Only header accounts can have child accounts',
      { parentCode }
    )
    this.name = 'ParentMustBeHeaderError'
  }
}

export class ParentTypeMismatchError extends ValidationError {
  constructor(parentType: string, childType: string) {
    super(
      'Parent and child accounts must have the same account type',
      { parentType, childType }
    )
    this.name = 'ParentTypeMismatchError'
  }
}

export class HeaderCannotBePostableError extends ValidationError {
  constructor() {
    super(
      'Header accounts cannot be used for transactions',
      { rule: 'header_not_postable' }
    )
    this.name = 'HeaderCannotBePostableError'
  }
}

export class InvalidNormalBalanceError extends ValidationError {
  constructor(accountType: string, normalBalance: string, expectedBalance: string) {
    super(
      `${accountType} accounts must have ${expectedBalance} normal balance`,
      { accountType, normalBalance, expectedBalance }
    )
    this.name = 'InvalidNormalBalanceError'
  }
}

export class MaxHierarchyLevelExceededError extends ValidationError {
  constructor(maxLevel: number) {
    super(
      `Account hierarchy cannot exceed ${maxLevel} levels`,
      { maxLevel }
    )
    this.name = 'MaxHierarchyLevelExceededError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class CannotDeleteWithChildrenError extends BusinessRuleError {
  constructor() {
    super(
      'Cannot delete account that has child accounts. Delete child accounts first.',
      { rule: 'delete_with_children' }
    )
    this.name = 'CannotDeleteWithChildrenError'
  }
}

export class CannotDeleteWithTransactionsError extends BusinessRuleError {
  constructor(accountCode?: string) {
    super(
      'Cannot delete account that has been used in transactions',
      { rule: 'delete_with_transactions', accountCode }
    )
    this.name = 'CannotDeleteWithTransactionsError'
  }
}

export class CircularReferenceError extends BusinessRuleError {
  constructor() {
    super(
      'This would create a circular reference in the account hierarchy',
      { rule: 'circular_reference' }
    )
    this.name = 'CircularReferenceError'
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

export class AccountCreateFailedError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to create account',
      { code: 'ACCOUNT_CREATE_FAILED', context: { error } }
    )
    this.name = 'AccountCreateFailedError'
  }
}

export class AccountUpdateFailedError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to update account',
      { code: 'ACCOUNT_UPDATE_FAILED', context: { error } }
    )
    this.name = 'AccountUpdateFailedError'
  }
}

export class AccountDeleteFailedError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to delete account',
      { code: 'ACCOUNT_DELETE_FAILED', context: { error } }
    )
    this.name = 'AccountDeleteFailedError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const ChartOfAccountErrors = {
  NOT_FOUND: (id?: string) => new AccountNotFoundError(id),
  CODE_EXISTS: (code: string, _companyId?: string) => 
    new AccountCodeExistsError(code || ''),
  INVALID_PARENT: (parentId?: string, reason?: string) => 
    new InvalidParentAccountError(parentId || 'unknown', reason || 'Invalid parent'),
  PARENT_COMPANY_MISMATCH: (parentCompany: string, childCompany: string) => 
    new ParentCompanyMismatchError(parentCompany, childCompany),
  PARENT_MUST_BE_HEADER: (parentCode?: string) => new ParentMustBeHeaderError(parentCode),
  PARENT_TYPE_MISMATCH: (parentType: string, childType: string) => 
    new ParentTypeMismatchError(parentType, childType),
  HEADER_CANNOT_BE_POSTABLE: () => new HeaderCannotBePostableError(),
  INVALID_NORMAL_BALANCE: (accountType: string, normalBalance: string, expectedBalance: string) => 
    new InvalidNormalBalanceError(accountType, normalBalance, expectedBalance),
  CANNOT_DELETE_WITH_CHILDREN: () => new CannotDeleteWithChildrenError(),
  CANNOT_DELETE_WITH_TRANSACTIONS: (accountCode?: string) => new CannotDeleteWithTransactionsError(accountCode),
  COMPANY_ACCESS_DENIED: (companyId: string) => new CompanyAccessDeniedError(companyId),
  MAX_HIERARCHY_LEVEL_EXCEEDED: (maxLevel: number) => new MaxHierarchyLevelExceededError(maxLevel),
  CREATE_FAILED: (error?: string) => new AccountCreateFailedError(error),
  UPDATE_FAILED: (error?: string) => new AccountUpdateFailedError(error),
  DELETE_FAILED: (error?: string) => new AccountDeleteFailedError(error),
}

