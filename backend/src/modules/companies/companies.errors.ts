/**
 * Companies Module Error Classes
 * Module-specific error classes untuk companies operations
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
} from '../../utils/errors.base'

// ============================================================================
// BASE ERROR CLASS - Using AppError via BusinessRuleError/ValidationError
// ============================================================================

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class CompanyNotFoundError extends NotFoundError {
  constructor(id?: string | number) {
    super('company', id)
    this.name = 'CompanyNotFoundError'
  }
}

export class CompanyCodeNotFoundError extends NotFoundError {
  constructor(code: string) {
    super('company_code', { code })
    this.name = 'CompanyCodeNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class CompanyCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Company code '${code}' already exists`,
      { conflictType: 'duplicate', companyCode: code }
    )
    this.name = 'CompanyCodeAlreadyExistsError'
  }
}

export class NPWPAlreadyExistsError extends ConflictError {
  constructor(npwp: string) {
    super(
      `NPWP '${npwp}' already registered`,
      { conflictType: 'duplicate', npwp }
    )
    this.name = 'NPWPAlreadyExistsError'
  }
}

export class CompanyEmailAlreadyExistsError extends ConflictError {
  constructor(email: string) {
    super(
      `Company email '${email}' already exists`,
      { conflictType: 'duplicate', email }
    )
    this.name = 'CompanyEmailAlreadyExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidCompanyTypeError extends ValidationError {
  constructor(type: string, validTypes?: string[]) {
    super(
      `Invalid company type: ${type}`,
      { type, validTypes }
    )
    this.name = 'InvalidCompanyTypeError'
  }
}

export class InvalidCompanyStatusError extends ValidationError {
  constructor(status: string, validStatuses?: string[]) {
    super(
      `Invalid status: ${status}`,
      { status, validStatuses }
    )
    this.name = 'InvalidCompanyStatusError'
  }
}

export class InvalidCompanyEmailError extends ValidationError {
  constructor(email: string) {
    super(
      `Invalid email format: ${email}`,
      { email }
    )
    this.name = 'InvalidCompanyEmailError'
  }
}

export class InvalidCompanyPhoneError extends ValidationError {
  constructor(phone: string) {
    super(
      `Invalid phone format: ${phone}`,
      { phone }
    )
    this.name = 'InvalidCompanyPhoneError'
  }
}

export class InvalidCompanyURLError extends ValidationError {
  constructor(url: string) {
    super(
      `Invalid website URL format: ${url}`,
      { url }
    )
    this.name = 'InvalidCompanyURLError'
  }
}

export class RequiredFieldError extends ValidationError {
  constructor(field: string) {
    super(
      `${field} is required`,
      { field }
    )
    this.name = 'RequiredFieldError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class CompanyInactiveError extends BusinessRuleError {
  constructor(id: string | number, companyName?: string) {
    super(
      `Company '${companyName || id}' is inactive`,
      { rule: 'company_active', companyId: id, companyName }
    )
    this.name = 'CompanyInactiveError'
  }
}

export class CannotDeleteDefaultCompanyError extends BusinessRuleError {
  constructor(companyName: string) {
    super(
      `Cannot delete default company '${companyName}'`,
      { rule: 'default_company_deletion', companyName }
    )
    this.name = 'CannotDeleteDefaultCompanyError'
  }
}

export class CannotDeactivateCompanyWithBranchesError extends BusinessRuleError {
  constructor(id: string | number, branchCount: number) {
    super(
      `Cannot deactivate company with ${branchCount} active branches`,
      { rule: 'company_with_branches', companyId: id, branchCount }
    )
    this.name = 'CannotDeactivateCompanyWithBranchesError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class CompanyCreateFailedError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to create company',
      { code: 'COMPANY_CREATE_FAILED', context: { error } }
    )
    this.name = 'CompanyCreateFailedError'
  }
}

export class CompanyUpdateFailedError extends DatabaseError {
  constructor(id: string | number, error?: string) {
    super(
      `Failed to update company ${id}`,
      { code: 'COMPANY_UPDATE_FAILED', context: { companyId: id, error } }
    )
    this.name = 'CompanyUpdateFailedError'
  }
}

export class CompanyDeleteFailedError extends DatabaseError {
  constructor(id: string | number, error?: string) {
    super(
      `Failed to delete company ${id}`,
      { code: 'COMPANY_DELETE_FAILED', context: { companyId: id, error } }
    )
    this.name = 'CompanyDeleteFailedError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const CompanyErrors = {
  NOT_FOUND: (id?: string | number) => new CompanyNotFoundError(id),
  CODE_NOT_FOUND: (code: string) => new CompanyCodeNotFoundError(code),
  CODE_EXISTS: (code?: string) => new CompanyCodeAlreadyExistsError(code || 'unknown'),
  NPWP_EXISTS: (npwp?: string | null) => new NPWPAlreadyExistsError(npwp || 'unknown'),
  EMAIL_EXISTS: (email: string) => new CompanyEmailAlreadyExistsError(email),
  INVALID_TYPE: (type: string, validTypes?: string[]) => 
    new InvalidCompanyTypeError(type, validTypes),
  INVALID_STATUS: (status: string, _validStatuses?: string[]) => 
    new InvalidCompanyStatusError(status),
  INVALID_EMAIL: (email: string) => new InvalidCompanyEmailError(email),
  INVALID_PHONE: (phone: string) => new InvalidCompanyPhoneError(phone),
  INVALID_URL: (url: string) => new InvalidCompanyURLError(url),
  REQUIRED_FIELD: (field: string) => new RequiredFieldError(field),
  INACTIVE: (id: string | number, companyName?: string) => 
    new CompanyInactiveError(id, companyName),
  DELETE_DEFAULT: (companyName: string) => new CannotDeleteDefaultCompanyError(companyName),
  DEACTIVATE_WITH_BRANCHES: (id: string | number, count: number) => 
    new CannotDeactivateCompanyWithBranchesError(id, count),
  CREATE_FAILED: (error?: string) => new CompanyCreateFailedError(error),
  UPDATE_FAILED: (id?: string | number, error?: string) => 
    new CompanyUpdateFailedError(id || 'unknown', error),
  DELETE_FAILED: (id: string | number, error?: string) => 
    new CompanyDeleteFailedError(id, error),
}

