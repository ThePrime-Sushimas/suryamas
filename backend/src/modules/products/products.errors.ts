/**
 * Products Error Classes
 * Module-specific error classes untuk products operations
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

export class ProductError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class ProductNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('product', id)
    this.name = 'ProductNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class DuplicateProductCodeError extends ConflictError {
  constructor(code: string) {
    super(
      `Product with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'DuplicateProductCodeError'
  }
}

export class DuplicateProductNameError extends ConflictError {
  constructor(name: string) {
    super(
      `Product with name '${name}' already exists`,
      { conflictType: 'duplicate', name }
    )
    this.name = 'DuplicateProductNameError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidProductStatusError extends ValidationError {
  constructor(status: string, validStatuses: string[]) {
    super(
      `Invalid status '${status}'`,
      { status, validStatuses }
    )
    this.name = 'InvalidProductStatusError'
  }
}

export class InvalidProductTypeError extends ValidationError {
  constructor(type: string, validTypes: string[]) {
    super(
      `Invalid product type '${type}'`,
      { type, validTypes }
    )
    this.name = 'InvalidProductTypeError'
  }
}

export class InvalidAverageCostError extends ValidationError {
  constructor(cost: number) {
    super(
      `Average cost must be >= 0, got ${cost}`,
      { cost, minimum: 0 }
    )
    this.name = 'InvalidAverageCostError'
  }
}

export class ProductValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'ProductValidationError'
  }
}

export class BulkOperationLimitError extends ValidationError {
  constructor(limit: number) {
    super(
      `Bulk operation exceeds maximum limit of ${limit} items`,
      { limit }
    )
    this.name = 'BulkOperationLimitError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class ProductCodeUpdateError extends BusinessRuleError {
  constructor() {
    super(
      'Product code cannot be updated',
      { rule: 'product_code_immutable' }
    )
    this.name = 'ProductCodeUpdateError'
  }
}

export class ProductInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Product cannot be deleted as it is being used by ${usageCount} transactions`,
      { rule: 'product_in_use', productId: id, usageCount }
    )
    this.name = 'ProductInUseError'
  }
}

export class CannotDeleteActiveProductError extends BusinessRuleError {
  constructor(id: string) {
    super(
      `Product cannot be deleted while active. Please deactivate first.`,
      { rule: 'delete_active_product', productId: id }
    )
    this.name = 'CannotDeleteActiveProductError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class ProductCreateFailedError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to create product',
      { code: 'PRODUCT_CREATE_FAILED', context: { error } }
    )
    this.name = 'ProductCreateFailedError'
  }
}

export class ProductUpdateFailedError extends DatabaseError {
  constructor(id: string, error?: string) {
    super(
      `Failed to update product ${id}`,
      { code: 'PRODUCT_UPDATE_FAILED', context: { productId: id, error } }
    )
    this.name = 'ProductUpdateFailedError'
  }
}

export class ProductDeleteFailedError extends DatabaseError {
  constructor(id: string, error?: string) {
    super(
      `Failed to delete product ${id}`,
      { code: 'PRODUCT_DELETE_FAILED', context: { productId: id, error } }
    )
    this.name = 'ProductDeleteFailedError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const ProductErrors = {
  NOT_FOUND: (id: string) => new ProductNotFoundError(id),
  DUPLICATE_CODE: (code: string) => new DuplicateProductCodeError(code),
  DUPLICATE_NAME: (name: string) => new DuplicateProductNameError(name),
  INVALID_STATUS: (status: string, validStatuses: string[]) => 
    new InvalidProductStatusError(status, validStatuses),
  INVALID_TYPE: (type: string, validTypes: string[]) => 
    new InvalidProductTypeError(type, validTypes),
  INVALID_COST: (cost: number) => new InvalidAverageCostError(cost),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new ProductValidationError(message, details),
  BULK_LIMIT: (limit: number) => new BulkOperationLimitError(limit),
  CODE_UPDATE_FORBIDDEN: () => new ProductCodeUpdateError(),
  IN_USE: (id: string, usageCount?: number) => new ProductInUseError(id, usageCount || 0),
  DELETE_ACTIVE: (id: string) => new CannotDeleteActiveProductError(id),
  CREATE_FAILED: (error?: string) => new ProductCreateFailedError(error),
  UPDATE_FAILED: (id: string, error?: string) => new ProductUpdateFailedError(id, error),
  DELETE_FAILED: (id: string, error?: string) => new ProductDeleteFailedError(id, error),
}

