/**
 * Product UOMs (Units of Measure) Error Classes
 * Module-specific error classes untuk product-uoms operations
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

export class ProductUomError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'ProductUomError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class ProductUomNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('product_uom', id)
    this.name = 'ProductUomNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class ProductUomCodeExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `UOM with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'ProductUomCodeExistsError'
  }
}

export class ProductUomNameExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `UOM with name '${name}' already exists`,
      { conflictType: 'duplicate', name }
    )
    this.name = 'ProductUomNameExistsError'
  }
}

export class DuplicateUnitNameError extends ProductUomNameExistsError {
  constructor(name: string) {
    super(name)
    this.name = 'DuplicateUnitNameError'
  }
}

export class BaseUnitExistsError extends ConflictError {
  constructor() {
    super(
      `Base unit already exists for this category`,
      { conflictType: 'duplicate', rule: 'base_unit_exists' }
    )
    this.name = 'BaseUnitExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidUomCodeError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'UOM code must not exceed 20 characters',
      { code: { maxLength: 20 } }
    )
    this.name = 'InvalidUomCodeError'
  }
}

export class InvalidUomNameError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'UOM name is required and must not exceed 100 characters',
      { name: { required: true, maxLength: 100 } }
    )
    this.name = 'InvalidUomNameError'
  }
}

export class InvalidConversionFactorError extends ValidationError {
  constructor(factor: number | string) {
    const numFactor = typeof factor === 'string' ? parseFloat(factor) : factor
    super(
      `Conversion factor must be greater than 0, got ${numFactor}`,
      { conversionFactor: numFactor, minimum: 0 }
    )
    this.name = 'InvalidConversionFactorError'
  }
}

export class ProductUomValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'ProductUomValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class ProductUomInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `UOM cannot be deleted as it is being used by ${usageCount} products`,
      { rule: 'uom_in_use', uomId: id, usageCount }
    )
    this.name = 'ProductUomInUseError'
  }
}

export class CannotDeleteDefaultUomError extends BusinessRuleError {
  constructor(uomName: string) {
    super(
      `Cannot delete default UOM '${uomName}'`,
      { rule: 'default_uom_deletion', uomName }
    )
    this.name = 'CannotDeleteDefaultUomError'
  }
}

export class CannotDeleteBaseUomError extends BusinessRuleError {
  constructor(uomName: string) {
    super(
      `Cannot delete base UOM '${uomName}'`,
      { rule: 'base_uom_deletion', uomName }
    )
    this.name = 'CannotDeleteBaseUomError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class ProductUomOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} product UOM`,
      { code: `PRODUCT_UOM_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'ProductUomOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const ProductUomErrors = {
  NOT_FOUND: (id?: string) => new ProductUomNotFoundError(id),
  CODE_EXISTS: (code: string) => new ProductUomCodeExistsError(code),
  NAME_EXISTS: (name: string) => new ProductUomNameExistsError(name),
  INVALID_CODE: (message?: string) => new InvalidUomCodeError(message),
  INVALID_NAME: (message?: string) => new InvalidUomNameError(message),
  INVALID_CONVERSION: (factor: number) => new InvalidConversionFactorError(factor),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new ProductUomValidationError(message, details),
  IN_USE: (id: string, usageCount?: number) => 
    new ProductUomInUseError(id, usageCount || 0),
  DELETE_DEFAULT: (name: string) => new CannotDeleteDefaultUomError(name),
  DELETE_BASE: (name: string) => new CannotDeleteBaseUomError(name),
  CREATE_FAILED: (error?: string) => new ProductUomOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new ProductUomOperationError('update', error),
  DELETE_FAILED: (error?: string) => new ProductUomOperationError('delete', error),
}

// ============================================================================
// ADDITIONAL ERROR CLASSES (FOR COMPATIBILITY)
// ============================================================================

// For UOM status validation
export class InvalidUomStatusError extends ValidationError {
  constructor(status: string, validStatuses: string[]) {
    super(
      `Invalid UOM status: ${status}`,
      { status, validStatuses }
    )
    this.name = 'InvalidUomStatusError'
  }
}

