/**
 * Suppliers Error Classes
 * Module-specific error classes untuk suppliers operations
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

export class SupplierError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'SupplierError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class SupplierNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('supplier', id)
    this.name = 'SupplierNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class SupplierCodeExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Supplier with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'SupplierCodeExistsError'
  }
}

// Alias for backward compatibility
export class SupplierCodeAlreadyExistsError extends SupplierCodeExistsError {
  constructor(code: string) {
    super(code)
    this.name = 'SupplierCodeAlreadyExistsError'
  }
}

export class SupplierEmailExistsError extends ConflictError {
  constructor(email: string) {
    super(
      `Supplier with email '${email}' already exists`,
      { conflictType: 'duplicate', email }
    )
    this.name = 'SupplierEmailExistsError'
  }
}

export class SupplierPhoneExistsError extends ConflictError {
  constructor(phone: string) {
    super(
      `Supplier with phone '${phone}' already exists`,
      { conflictType: 'duplicate', phone }
    )
    this.name = 'SupplierPhoneExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidSupplierCodeError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Supplier code must not exceed 50 characters',
      { code: { maxLength: 50 } }
    )
    this.name = 'InvalidSupplierCodeError'
  }
}

export class InvalidSupplierNameError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Supplier name is required and must not exceed 255 characters',
      { name: { required: true, maxLength: 255 } }
    )
    this.name = 'InvalidSupplierNameError'
  }
}

export class InvalidSupplierEmailError extends ValidationError {
  constructor(email: string) {
    super(
      `Invalid email format: ${email}`,
      { email }
    )
    this.name = 'InvalidSupplierEmailError'
  }
}

export class InvalidSupplierPhoneError extends ValidationError {
  constructor(phone: string) {
    super(
      `Invalid phone format: ${phone}`,
      { phone }
    )
    this.name = 'InvalidSupplierPhoneError'
  }
}

export class SupplierValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'SupplierValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class SupplierInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Supplier cannot be deleted as it is being used in ${usageCount} transactions`,
      { rule: 'supplier_in_use', supplierId: id, usageCount }
    )
    this.name = 'SupplierInUseError'
  }
}

export class InactiveSupplierError extends BusinessRuleError {
  constructor(id: string) {
    super(
      `Cannot use inactive supplier`,
      { rule: 'inactive_supplier', supplierId: id }
    )
    this.name = 'InactiveSupplierError'
  }
}

export class CannotDeleteDefaultSupplierError extends BusinessRuleError {
  constructor(supplierName: string) {
    super(
      `Cannot delete default supplier '${supplierName}'`,
      { rule: 'default_supplier_deletion', supplierName }
    )
    this.name = 'CannotDeleteDefaultSupplierError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class SupplierOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} supplier`,
      { code: `SUPPLIER_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'SupplierOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const SupplierErrors = {
  NOT_FOUND: (id?: string) => new SupplierNotFoundError(id),
  CODE_EXISTS: (code: string) => new SupplierCodeExistsError(code),
  EMAIL_EXISTS: (email: string) => new SupplierEmailExistsError(email),
  PHONE_EXISTS: (phone: string) => new SupplierPhoneExistsError(phone),
  INVALID_CODE: (message?: string) => new InvalidSupplierCodeError(message),
  INVALID_NAME: (message?: string) => new InvalidSupplierNameError(message),
  INVALID_EMAIL: (email: string) => new InvalidSupplierEmailError(email),
  INVALID_PHONE: (phone: string) => new InvalidSupplierPhoneError(phone),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new SupplierValidationError(message, details),
  IN_USE: (id: string, usageCount?: number) => 
    new SupplierInUseError(id, usageCount || 0),
  INACTIVE: (id: string) => new InactiveSupplierError(id),
  DELETE_DEFAULT: (name: string) => new CannotDeleteDefaultSupplierError(name),
  CREATE_FAILED: (error?: string) => new SupplierOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new SupplierOperationError('update', error),
  DELETE_FAILED: (error?: string) => new SupplierOperationError('delete', error),
}

