/**
 * Users Error Classes
 * Module-specific error classes untuk users operations
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
  AuthenticationError,
  DatabaseError
} from '../../utils/errors.base'

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class UserError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'UserError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class UserNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('user', id)
    this.name = 'UserNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class UserEmailExistsError extends ConflictError {
  constructor(email: string) {
    super(
      `User with email '${email}' already exists`,
      { conflictType: 'duplicate', email }
    )
    this.name = 'UserEmailExistsError'
  }
}

export class UserUsernameExistsError extends ConflictError {
  constructor(username: string) {
    super(
      `User with username '${username}' already exists`,
      { conflictType: 'duplicate', username }
    )
    this.name = 'UserUsernameExistsError'
  }
}

export class UserEmployeeIdExistsError extends ConflictError {
  constructor(employeeId: string) {
    super(
      `User with employee ID '${employeeId}' already exists`,
      { conflictType: 'duplicate', employeeId }
    )
    this.name = 'UserEmployeeIdExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidUserEmailError extends ValidationError {
  constructor(email: string) {
    super(
      `Invalid email format: ${email}`,
      { email }
    )
    this.name = 'InvalidUserEmailError'
  }
}

export class InvalidUserPasswordError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Password does not meet requirements',
      { rule: 'password_requirements' }
    )
    this.name = 'InvalidUserPasswordError'
  }
}

export class InvalidUserStatusError extends ValidationError {
  constructor(status: string, validStatuses: string[]) {
    super(
      `Invalid user status: ${status}`,
      { status, validStatuses }
    )
    this.name = 'InvalidUserStatusError'
  }
}

export class UserValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'UserValidationError'
  }
}

// ============================================================================
// AUTHENTICATION ERRORS
// ============================================================================

export class UserInvalidCredentialsError extends AuthenticationError {
  constructor() {
    super('Invalid email or password')
    this.name = 'UserInvalidCredentialsError'
  }
}

export class UserAccountLockedError extends AuthenticationError {
  constructor() {
    super('Account is locked. Please contact administrator')
    this.name = 'UserAccountLockedError'
  }
}

export class UserAccountInactiveError extends AuthenticationError {
  constructor() {
    super('Account is inactive. Please contact administrator')
    this.name = 'UserAccountInactiveError'
  }
}

export class UserTokenExpiredError extends AuthenticationError {
  constructor() {
    super('Token has expired. Please login again')
    this.name = 'UserTokenExpiredError'
  }
}

export class UserInvalidTokenError extends AuthenticationError {
  constructor() {
    super('Invalid token')
    this.name = 'UserInvalidTokenError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class UserInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `User cannot be deleted as it is being used in ${usageCount} transactions`,
      { rule: 'user_in_use', userId: id, usageCount }
    )
    this.name = 'UserInUseError'
  }
}

export class CannotDeleteOwnAccountError extends BusinessRuleError {
  constructor() {
    super('Cannot delete your own account')
    this.name = 'CannotDeleteOwnAccountError'
  }
}

export class CannotDeactivateOwnAccountError extends BusinessRuleError {
  constructor() {
    super('Cannot deactivate your own account')
    this.name = 'CannotDeactivateOwnAccountError'
  }
}

export class CannotDeleteSuperAdminError extends BusinessRuleError {
  constructor() {
    super('Cannot delete super admin account')
    this.name = 'CannotDeleteSuperAdminError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class UserOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} user`,
      { code: `USER_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'UserOperationError'
  }
}

export class UserPasswordResetError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to reset password',
      { code: 'USER_PASSWORD_RESET_FAILED', context: { error } }
    )
    this.name = 'UserPasswordResetError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const UserErrors = {
  NOT_FOUND: (id?: string) => new UserNotFoundError(id),
  
  // Conflict
  EMAIL_EXISTS: (email: string) => new UserEmailExistsError(email),
  USERNAME_EXISTS: (username: string) => new UserUsernameExistsError(username),
  EMPLOYEE_ID_EXISTS: (employeeId: string) => new UserEmployeeIdExistsError(employeeId),
  
  // Validation
  INVALID_EMAIL: (email: string) => new InvalidUserEmailError(email),
  INVALID_PASSWORD: (message?: string) => new InvalidUserPasswordError(message),
  INVALID_STATUS: (status: string, validStatuses: string[]) => 
    new InvalidUserStatusError(status, validStatuses),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new UserValidationError(message, details),
  
  // Authentication
  INVALID_CREDENTIALS: () => new UserInvalidCredentialsError(),
  ACCOUNT_LOCKED: () => new UserAccountLockedError(),
  ACCOUNT_INACTIVE: () => new UserAccountInactiveError(),
  TOKEN_EXPIRED: () => new UserTokenExpiredError(),
  INVALID_TOKEN: () => new UserInvalidTokenError(),
  
  // Business rules
  IN_USE: (id: string, usageCount?: number) => new UserInUseError(id, usageCount || 0),
  CANNOT_DELETE_OWN: () => new CannotDeleteOwnAccountError(),
  CANNOT_DEACTIVATE_OWN: () => new CannotDeactivateOwnAccountError(),
  CANNOT_DELETE_SUPER_ADMIN: () => new CannotDeleteSuperAdminError(),
  
  // Database
  CREATE_FAILED: (error?: string) => new UserOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new UserOperationError('update', error),
  DELETE_FAILED: (error?: string) => new UserOperationError('delete', error),
  PASSWORD_RESET_FAILED: (error?: string) => new UserPasswordResetError(error),
}

