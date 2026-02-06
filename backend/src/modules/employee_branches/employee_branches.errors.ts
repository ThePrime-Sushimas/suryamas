/**
 * Employee Branches Error Classes
 * Module-specific error classes untuk employee branches operations
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
// BASE ERROR CLASS
// ============================================================================

export class EmployeeBranchError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'EmployeeBranchError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class EmployeeBranchNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('employee_branch_assignment', id)
    this.name = 'EmployeeBranchNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class DuplicateAssignmentError extends ConflictError {
  constructor(employeeId: string, branchId: string) {
    super(
      `Employee is already assigned to this branch`,
      { conflictType: 'duplicate', employeeId, branchId }
    )
    this.name = 'DuplicateAssignmentError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidAssignmentDateError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Invalid assignment date',
      { rule: 'assignment_date' }
    )
    this.name = 'InvalidAssignmentDateError'
  }
}

export class EmployeeBranchValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'EmployeeBranchValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class CannotRemovePrimaryAssignmentError extends BusinessRuleError {
  constructor(employeeId: string) {
    super(
      `Cannot remove primary branch assignment for employee ${employeeId}`,
      { rule: 'primary_assignment_removal', employeeId }
    )
    this.name = 'CannotRemovePrimaryAssignmentError'
  }
}

export class EmployeeBranchInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Cannot delete assignment as it is being used`,
      { rule: 'assignment_in_use', assignmentId: id, usageCount }
    )
    this.name = 'EmployeeBranchInUseError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class EmployeeBranchOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} employee branch assignment`,
      { code: `EMPLOYEE_BRANCH_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'EmployeeBranchOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const EmployeeBranchErrors = {
  NOT_FOUND: (id?: string) => new EmployeeBranchNotFoundError(id),
  DUPLICATE_ASSIGNMENT: (employeeId: string, branchId: string) => 
    new DuplicateAssignmentError(employeeId, branchId),
  INVALID_DATE: (message?: string) => new InvalidAssignmentDateError(message),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new EmployeeBranchValidationError(message, details),
  CANNOT_REMOVE_PRIMARY: (employeeId: string) => 
    new CannotRemovePrimaryAssignmentError(employeeId),
  IN_USE: (id: string, usageCount?: number) => 
    new EmployeeBranchInUseError(id, usageCount || 0),
  CREATE_FAILED: (error?: string) => new EmployeeBranchOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new EmployeeBranchOperationError('update', error),
  DELETE_FAILED: (error?: string) => new EmployeeBranchOperationError('delete', error),
  
  // Additional error factories for compatibility (with optional arguments)
  EMPLOYEE_NOT_FOUND: () => new EmployeeBranchNotFoundError(undefined),
  BRANCH_NOT_FOUND: () => new EmployeeBranchNotFoundError(undefined),
  ALREADY_EXISTS: (employeeId?: string, branchId?: string) => 
    new DuplicateAssignmentError(employeeId || '', branchId || ''),
  NO_ASSIGNMENT: () => new EmployeeBranchNotFoundError(undefined),
  CANNOT_DELETE_PRIMARY: () => 
    new CannotRemovePrimaryAssignmentError(''),
}

