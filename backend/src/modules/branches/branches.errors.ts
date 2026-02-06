/**
 * Branches Module Error Classes
 * Module-specific error classes untuk branches operations
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

export class BranchNotFoundError extends NotFoundError {
  constructor(id?: string | number) {
    super('branch', id)
    this.name = 'BranchNotFoundError'
  }
}

export class BranchCodeNotFoundError extends NotFoundError {
  constructor(code: string) {
    super('branch_code', { code })
    this.name = 'BranchCodeNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class BranchCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Branch code '${code}' already exists`,
      { conflictType: 'duplicate', branchCode: code }
    )
    this.name = 'BranchCodeAlreadyExistsError'
  }
}

export class BranchNameAlreadyExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `Branch name '${name}' already exists`,
      { conflictType: 'duplicate', branchName: name }
    )
    this.name = 'BranchNameAlreadyExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidBranchStatusError extends ValidationError {
  constructor(status: string, validStatuses?: string[]) {
    super(
      `Invalid status: ${status}`,
      { status, validStatuses }
    )
    this.name = 'InvalidBranchStatusError'
  }
}

export class InvalidEmailError extends ValidationError {
  constructor(email: string) {
    super(
      `Invalid email format: ${email}`,
      { email }
    )
    this.name = 'InvalidEmailError'
  }
}

export class InvalidPhoneError extends ValidationError {
  constructor(phone: string) {
    super(
      `Invalid phone format: ${phone}`,
      { phone }
    )
    this.name = 'InvalidPhoneError'
  }
}

export class InvalidCoordinatesError extends ValidationError {
  constructor(lat: number, lng: number) {
    super(
      `Invalid coordinates: lat=${lat}, lng=${lng}`,
      { latitude: lat, longitude: lng }
    )
    this.name = 'InvalidCoordinatesError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class BranchInUseError extends BusinessRuleError {
  constructor(id: string | number, branchName?: string) {
    super(
      `Branch '${branchName || id}' cannot be deleted as it is being used`,
      { rule: 'branch_in_use', branchId: id, branchName }
    )
    this.name = 'BranchInUseError'
  }
}

export class BranchAlreadyInactiveError extends BusinessRuleError {
  constructor(id: string | number, branchName?: string) {
    super(
      `Branch '${branchName || id}' is already inactive`,
      { rule: 'branch_status', branchId: id, branchName, currentState: 'inactive' }
    )
    this.name = 'BranchAlreadyInactiveError'
  }
}

export class BranchAlreadyActiveError extends BusinessRuleError {
  constructor(id: string | number, branchName?: string) {
    super(
      `Branch '${branchName || id}' is already active`,
      { rule: 'branch_status', branchId: id, branchName, currentState: 'active' }
    )
    this.name = 'BranchAlreadyActiveError'
  }
}

export class CannotDeleteDefaultBranchError extends BusinessRuleError {
  constructor(branchName: string) {
    super(
      `Cannot delete default branch '${branchName}'`,
      { rule: 'default_branch_deletion', branchName }
    )
    this.name = 'CannotDeleteDefaultBranchError'
  }
}

export class CannotDeactivateBranchWithEmployeesError extends BusinessRuleError {
  constructor(id: string | number, employeeCount: number) {
    super(
      `Cannot deactivate branch with ${employeeCount} active employees`,
      { rule: 'branch_with_employees', branchId: id, employeeCount }
    )
    this.name = 'CannotDeactivateBranchWithEmployeesError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class BranchOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} branch`,
      { code: `BRANCH_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'BranchOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const BranchErrors = {
  NOT_FOUND: (id?: string | number) => new BranchNotFoundError(id),
  CODE_NOT_FOUND: (code: string) => new BranchCodeNotFoundError(code),
  CODE_EXISTS: (code: string) => new BranchCodeAlreadyExistsError(code),
  NAME_EXISTS: (name: string) => new BranchNameAlreadyExistsError(name),
  INVALID_STATUS: (status?: string, _validStatuses?: string[]) => 
    new InvalidBranchStatusError(status || 'unknown'),
  INVALID_EMAIL: (email: string) => new InvalidEmailError(email),
  INVALID_PHONE: (phone: string) => new InvalidPhoneError(phone),
  INVALID_COORDINATES: (lat: number, lng: number) => new InvalidCoordinatesError(lat, lng),
  IN_USE: (id: string | number, branchName?: string) => new BranchInUseError(id, branchName),
  ALREADY_INACTIVE: (id: string | number, branchName?: string) => 
    new BranchAlreadyInactiveError(id, branchName),
  ALREADY_ACTIVE: (id: string | number, branchName?: string) => 
    new BranchAlreadyActiveError(id, branchName),
  DELETE_DEFAULT: (branchName: string) => new CannotDeleteDefaultBranchError(branchName),
  DEACTIVATE_WITH_EMPLOYEES: (id: string | number, count: number) => 
    new CannotDeactivateBranchWithEmployeesError(id, count),
  CREATE_FAILED: (error?: string) => new BranchOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new BranchOperationError('update', error),
  DELETE_FAILED: (error?: string) => new BranchOperationError('delete', error),
}

