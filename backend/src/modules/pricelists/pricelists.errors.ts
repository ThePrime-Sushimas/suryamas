/**
 * Pricelists Error Classes
 * Module-specific error classes untuk pricelists operations
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

export class PricelistError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PricelistError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class PricelistNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('pricelist', id)
    this.name = 'PricelistNotFoundError'
  }
}

export class PricelistItemNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('pricelist_item', id)
    this.name = 'PricelistItemNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class PricelistCodeExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Pricelist with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'PricelistCodeExistsError'
  }
}

export class PricelistNameExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `Pricelist with name '${name}' already exists`,
      { conflictType: 'duplicate', name }
    )
    this.name = 'PricelistNameExistsError'
  }
}

export class PricelistDuplicateItemError extends ConflictError {
  constructor(productId: string, pricelistId: string) {
    super(
      `Product already exists in pricelist`,
      { conflictType: 'duplicate', productId, pricelistId }
    )
    this.name = 'PricelistDuplicateItemError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidPricelistCodeError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Pricelist code must not exceed 50 characters',
      { code: { maxLength: 50 } }
    )
    this.name = 'InvalidPricelistCodeError'
  }
}

export class InvalidPricelistNameError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Pricelist name is required and must not exceed 255 characters',
      { name: { required: true, maxLength: 255 } }
    )
    this.name = 'InvalidPricelistNameError'
  }
}

export class InvalidPricelistPriceError extends ValidationError {
  constructor(price: number) {
    super(
      `Price must be greater than or equal to 0, got ${price}`,
      { price, minimum: 0 }
    )
    this.name = 'InvalidPricelistPriceError'
  }
}

export class InvalidPricelistDateRangeError extends ValidationError {
  constructor(startDate?: string, endDate?: string) {
    super(
      `Invalid date range: start date must be before end date`,
      { startDate, endDate }
    )
    this.name = 'InvalidPricelistDateRangeError'
  }
}

export class PricelistValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'PricelistValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class PricelistInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Pricelist cannot be deleted as it is being used by ${usageCount} orders`,
      { rule: 'pricelist_in_use', pricelistId: id, usageCount }
    )
    this.name = 'PricelistInUseError'
  }
}

export class CannotDeleteDefaultPricelistError extends BusinessRuleError {
  constructor(pricelistName: string) {
    super(
      `Cannot delete default pricelist '${pricelistName}'`,
      { rule: 'default_pricelist_deletion', pricelistName }
    )
    this.name = 'CannotDeleteDefaultPricelistError'
  }
}

export class InactivePricelistError extends BusinessRuleError {
  constructor(id: string) {
    super(
      `Cannot use inactive pricelist`,
      { rule: 'inactive_pricelist', pricelistId: id }
    )
    this.name = 'InactivePricelistError'
  }
}

export class PricelistExpiredError extends BusinessRuleError {
  constructor(id: string, endDate: string) {
    super(
      `Pricelist has expired on ${endDate}`,
      { rule: 'pricelist_expired', pricelistId: id, endDate }
    )
    this.name = 'PricelistExpiredError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class PricelistOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} pricelist`,
      { code: `PRICELIST_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'PricelistOperationError'
  }
}

export class PricelistItemOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} pricelist item`,
      { code: `PRICELIST_ITEM_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'PricelistItemOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const PricelistErrors = {
  NOT_FOUND: (id?: string) => new PricelistNotFoundError(id),
  ITEM_NOT_FOUND: (id?: string) => new PricelistItemNotFoundError(id),
  
  // Conflict
  CODE_EXISTS: (code: string) => new PricelistCodeExistsError(code),
  NAME_EXISTS: (name: string) => new PricelistNameExistsError(name),
  DUPLICATE_ITEM: (productId: string, pricelistId: string) => 
    new PricelistDuplicateItemError(productId, pricelistId),
  
  // Validation
  INVALID_CODE: (message?: string) => new InvalidPricelistCodeError(message),
  INVALID_NAME: (message?: string) => new InvalidPricelistNameError(message),
  INVALID_PRICE: (price: number) => new InvalidPricelistPriceError(price),
  INVALID_DATE_RANGE: (startDate: string, endDate: string) => 
    new InvalidPricelistDateRangeError(startDate, endDate),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new PricelistValidationError(message, details),
  
  // Business rules
  IN_USE: (id: string, usageCount?: number) => new PricelistInUseError(id, usageCount || 0),
  DELETE_DEFAULT: (name: string) => new CannotDeleteDefaultPricelistError(name),
  INACTIVE: (id: string) => new InactivePricelistError(id),
  EXPIRED: (id: string, endDate: string) => new PricelistExpiredError(id, endDate),
  
  // Database
  CREATE_FAILED: (error?: string) => new PricelistOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new PricelistOperationError('update', error),
  DELETE_FAILED: (error?: string) => new PricelistOperationError('delete', error),
  ITEM_CREATE_FAILED: (error?: string) => new PricelistItemOperationError('create', error),
  ITEM_UPDATE_FAILED: (error?: string) => new PricelistItemOperationError('update', error),
  ITEM_DELETE_FAILED: (error?: string) => new PricelistItemOperationError('delete', error),
  
  // Additional error factories for compatibility (with optional arguments)
  DEFAULT_PRICELIST: () => new PricelistNotFoundError(undefined),
  ITEM_PRICELIST_NOT_FOUND: () => new PricelistItemNotFoundError(undefined),
}

// ============================================================================
// ADDITIONAL ERROR CLASSES (FOR COMPATIBILITY)
// ============================================================================

// For restore duplicate check
export class DuplicateRestoreError extends ConflictError {
  constructor(pricelistId?: string) {
    super(
      `Cannot restore pricelist as it would create a duplicate`,
      { conflictType: 'duplicate', pricelistId }
    )
    this.name = 'DuplicateRestoreError'
  }
}

// For draft status check
export class PricelistNotDraftError extends BusinessRuleError {
  constructor(id?: string) {
    super(
      `Pricelist '${id || 'unknown'}' is not in draft status`,
      { rule: 'pricelist_not_draft', pricelistId: id }
    )
    this.name = 'PricelistNotDraftError'
  }
}

// For duplicate active pricelist check
export class DuplicateActivePricelistError extends ConflictError {
  constructor(productId?: string) {
    super(
      `Product '${productId || 'unknown'}' already has an active pricelist`,
      { conflictType: 'duplicate', productId }
    )
    this.name = 'DuplicateActivePricelistError'
  }
}

// Alias for InvalidPricelistDateRangeError
export { InvalidPricelistDateRangeError as InvalidDateRangeError }

