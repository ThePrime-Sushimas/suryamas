/**
 * Permissions Error Classes
 * Module-specific error classes untuk permissions operations
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

// Note: Named PermissionsError to avoid conflict with PermissionError from errors.base.ts
export class PermissionsError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PermissionsError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class PermissionNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('permission', id)
    this.name = 'PermissionNotFoundError'
  }
}

export class PermissionGroupNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('permission_group', id)
    this.name = 'PermissionGroupNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class PermissionCodeExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Permission with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'PermissionCodeExistsError'
  }
}

export class PermissionNameExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `Permission with name '${name}' already exists`,
      { conflictType: 'duplicate', name }
    )
    this.name = 'PermissionNameExistsError'
  }
}

export class PermissionGroupNameExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `Permission group with name '${name}' already exists`,
      { conflictType: 'duplicate', name }
    )
    this.name = 'PermissionGroupNameExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidPermissionCodeError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Permission code must not exceed 100 characters',
      { code: { maxLength: 100 } }
    )
    this.name = 'InvalidPermissionCodeError'
  }
}

export class InvalidPermissionNameError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Permission name is required and must not exceed 255 characters',
      { name: { required: true, maxLength: 255 } }
    )
    this.name = 'InvalidPermissionNameError'
  }
}

export class InvalidPermissionActionError extends ValidationError {
  constructor(action: string, validActions: string[]) {
    super(
      `Invalid permission action: ${action}. Must be one of: ${validActions.join(', ')}`,
      { action, validActions }
    )
    this.name = 'InvalidPermissionActionError'
  }
}

export class PermissionValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'PermissionValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class PermissionInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Permission cannot be deleted as it is being used by ${usageCount} roles`,
      { rule: 'permission_in_use', permissionId: id, usageCount }
    )
    this.name = 'PermissionInUseError'
  }
}

export class PermissionGroupInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Permission group cannot be deleted as it is being used by ${usageCount} permissions`,
      { rule: 'permission_group_in_use', groupId: id, usageCount }
    )
    this.name = 'PermissionGroupInUseError'
  }
}

export class CannotDeleteSystemPermissionError extends BusinessRuleError {
  constructor(permissionName: string) {
    super(
      `Cannot delete system permission '${permissionName}'`,
      { rule: 'system_permission_deletion', permissionName }
    )
    this.name = 'CannotDeleteSystemPermissionError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class PermissionOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} permission`,
      { code: `PERMISSION_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'PermissionOperationError'
  }
}

export class PermissionAssignmentError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to assign permission',
      { code: 'PERMISSION_ASSIGNMENT_FAILED', context: { error } }
    )
    this.name = 'PermissionAssignmentError'
  }
}

// ============================================================================
// RE-EXPORT BASE ERROR CLASSES
// ============================================================================

// Re-export base error classes for convenience
export { NotFoundError, ConflictError, ValidationError, BusinessRuleError, DatabaseError } from '../../utils/errors.base'

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const PermissionErrors = {
  NOT_FOUND: (id?: string) => new PermissionNotFoundError(id),
  GROUP_NOT_FOUND: (id?: string) => new PermissionGroupNotFoundError(id),
  
  // Conflict
  CODE_EXISTS: (code: string) => new PermissionCodeExistsError(code),
  NAME_EXISTS: (name: string) => new PermissionNameExistsError(name),
  GROUP_NAME_EXISTS: (name: string) => new PermissionGroupNameExistsError(name),
  
  // Validation
  INVALID_CODE: (message?: string) => new InvalidPermissionCodeError(message),
  INVALID_NAME: (message?: string) => new InvalidPermissionNameError(message),
  INVALID_ACTION: (action: string, validActions: string[]) => 
    new InvalidPermissionActionError(action, validActions),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new PermissionValidationError(message, details),
  
  // Business rules
  IN_USE: (id: string, usageCount?: number) => new PermissionInUseError(id, usageCount || 0),
  GROUP_IN_USE: (id: string, usageCount?: number) => 
    new PermissionGroupInUseError(id, usageCount || 0),
  DELETE_SYSTEM: (name: string) => new CannotDeleteSystemPermissionError(name),
  
  // Database
  CREATE_FAILED: (error?: string) => new PermissionOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new PermissionOperationError('update', error),
  DELETE_FAILED: (error?: string) => new PermissionOperationError('delete', error),
  ASSIGN_FAILED: (error?: string) => new PermissionAssignmentError(error),
}

