/**
 * Supplier Products Error Classes
 * Module-specific error classes untuk supplier-products operations
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

export class SupplierProductError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'SupplierProductError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class SupplierProductNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('supplier_product', id)
    this.name = 'SupplierProductNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class DuplicateSupplierProductError extends ConflictError {
  constructor(supplierId: string, productId: string) {
    super(
      `Product already linked to this supplier`,
      { conflictType: 'duplicate', supplierId, productId }
    )
    this.name = 'DuplicateSupplierProductError'
  }
}

export class SupplierProductCodeExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Supplier product with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'SupplierProductCodeExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidSupplierProductPriceError extends ValidationError {
  constructor(price: number) {
    super(
      `Price must be greater than or equal to 0, got ${price}`,
      { price, minimum: 0 }
    )
    this.name = 'InvalidSupplierProductPriceError'
  }
}

export class InvalidSupplierProductQuantityError extends ValidationError {
  constructor(quantity: number) {
    super(
      `Minimum order quantity must be greater than 0, got ${quantity}`,
      { quantity, minimum: 1 }
    )
    this.name = 'InvalidSupplierProductQuantityError'
  }
}

export class SupplierProductValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'SupplierProductValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class SupplierProductInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Supplier product cannot be deleted as it is being used in ${usageCount} orders`,
      { rule: 'supplier_product_in_use', supplierProductId: id, usageCount }
    )
    this.name = 'SupplierProductInUseError'
  }
}

export class InactiveSupplierProductError extends BusinessRuleError {
  constructor(id: string) {
    super(
      `Cannot use inactive supplier product`,
      { rule: 'inactive_supplier_product', supplierProductId: id }
    )
    this.name = 'InactiveSupplierProductError'
  }
}

export class InvalidSupplierError extends BusinessRuleError {
  constructor(supplierId: string, _reason?: string) {
    super(
      `Invalid supplier: ${supplierId}`,
      { rule: 'invalid_supplier', supplierId }
    )
    this.name = 'InvalidSupplierError'
  }
}

export class InvalidProductError extends BusinessRuleError {
  constructor(productId: string, _reason?: string) {
    super(
      `Invalid product: ${productId}`,
      { rule: 'invalid_product', productId }
    )
    this.name = 'InvalidProductError'
  }
}

export class MaxPreferredSuppliersError extends BusinessRuleError {
  constructor(productId: string, maxCount: number) {
    super(
      `Product ${productId} already has ${maxCount} preferred suppliers`,
      { rule: 'max_preferred_suppliers', productId, maxCount }
    )
    this.name = 'MaxPreferredSuppliersError'
  }
}

export class BulkOperationLimitError extends BusinessRuleError {
  constructor(limit: number, _actual?: number) {
    super(
      `Bulk operation exceeds maximum limit of ${limit} items`,
      { rule: 'bulk_operation_limit', limit }
    )
    this.name = 'BulkOperationLimitError'
  }
}

export class InvalidCurrencyError extends BusinessRuleError {
  constructor(currency: string, _validCurrencies?: string[]) {
    super(
      `Unsupported currency: ${currency}`,
      { rule: 'invalid_currency', currency }
    )
    this.name = 'InvalidCurrencyError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class SupplierProductOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} supplier product`,
      { code: `SUPPLIER_PRODUCT_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'SupplierProductOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const SupplierProductErrors = {
  NOT_FOUND: (id?: string) => new SupplierProductNotFoundError(id),
  DUPLICATE: (supplierId: string, productId: string) => 
    new DuplicateSupplierProductError(supplierId, productId),
  CODE_EXISTS: (code: string) => new SupplierProductCodeExistsError(code),
  INVALID_PRICE: (price: number) => new InvalidSupplierProductPriceError(price),
  INVALID_QUANTITY: (quantity: number) => new InvalidSupplierProductQuantityError(quantity),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new SupplierProductValidationError(message, details),
  IN_USE: (id: string, usageCount?: number) => 
    new SupplierProductInUseError(id, usageCount || 0),
  INACTIVE: (id: string) => new InactiveSupplierProductError(id),
  CREATE_FAILED: (error?: string) => new SupplierProductOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new SupplierProductOperationError('update', error),
  DELETE_FAILED: (error?: string) => new SupplierProductOperationError('delete', error),
}

