/**
 * Sub Categories Error Classes
 * Module-specific error classes untuk sub-categories operations
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

export class SubCategoryError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'SubCategoryError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class SubCategoryNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('sub_category', id)
    this.name = 'SubCategoryNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class SubCategoryCodeExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Sub category with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'SubCategoryCodeExistsError'
  }
}

export class SubCategoryNameExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `Sub category with name '${name}' already exists`,
      { conflictType: 'duplicate', name }
    )
    this.name = 'SubCategoryNameExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidSubCategoryCodeError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Sub category code must not exceed 50 characters',
      { code: { maxLength: 50 } }
    )
    this.name = 'InvalidSubCategoryCodeError'
  }
}

export class InvalidSubCategoryNameError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Sub category name is required and must not exceed 255 characters',
      { name: { required: true, maxLength: 255 } }
    )
    this.name = 'InvalidSubCategoryNameError'
  }
}

export class SubCategoryValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'SubCategoryValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class SubCategoryInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Sub category cannot be deleted as it is being used by ${usageCount} products`,
      { rule: 'sub_category_in_use', subCategoryId: id, usageCount }
    )
    this.name = 'SubCategoryInUseError'
  }
}

export class CategoryRequiredError extends BusinessRuleError {
  constructor() {
    super(
      'Parent category is required for sub category',
      { rule: 'parent_category_required' }
    )
    this.name = 'CategoryRequiredError'
  }
}

export class CannotDeactivateSubCategoryWithProductsError extends BusinessRuleError {
  constructor(id: string, productCount: number) {
    super(
      `Cannot deactivate sub category with ${productCount} active products`,
      { rule: 'deactivate_with_products', subCategoryId: id, productCount }
    )
    this.name = 'CannotDeactivateSubCategoryWithProductsError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class SubCategoryOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} sub category`,
      { code: `SUB_CATEGORY_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'SubCategoryOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const SubCategoryErrors = {
  NOT_FOUND: (id?: string) => new SubCategoryNotFoundError(id),
  CODE_EXISTS: (code: string) => new SubCategoryCodeExistsError(code),
  NAME_EXISTS: (name: string) => new SubCategoryNameExistsError(name),
  INVALID_CODE: (message?: string) => new InvalidSubCategoryCodeError(message),
  INVALID_NAME: (message?: string) => new InvalidSubCategoryNameError(message),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new SubCategoryValidationError(message, details),
  IN_USE: (id: string, usageCount?: number) => 
    new SubCategoryInUseError(id, usageCount || 0),
  CATEGORY_REQUIRED: () => new CategoryRequiredError(),
  DEACTIVATE_WITH_PRODUCTS: (id: string, count: number) => 
    new CannotDeactivateSubCategoryWithProductsError(id, count),
  CREATE_FAILED: (error?: string) => new SubCategoryOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new SubCategoryOperationError('update', error),
  DELETE_FAILED: (error?: string) => new SubCategoryOperationError('delete', error),
}

