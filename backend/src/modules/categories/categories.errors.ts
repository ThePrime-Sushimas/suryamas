/**
 * Categories Error Classes
 * Module-specific error classes untuk categories operations
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

export class CategoryError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'CategoryError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class CategoryNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('category', id)
    this.name = 'CategoryNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class CategoryCodeExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Category with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'CategoryCodeExistsError'
  }
}

export class CategoryNameExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `Category with name '${name}' already exists`,
      { conflictType: 'duplicate', name }
    )
    this.name = 'CategoryNameExistsError'
  }
}

// Alias for backward compatibility
export class CategoryAlreadyExistsError extends CategoryNameExistsError {
  constructor(name: string) {
    super(name)
    this.name = 'CategoryAlreadyExistsError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidCategoryCodeError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Category code must not exceed 50 characters',
      { code: { maxLength: 50 } }
    )
    this.name = 'InvalidCategoryCodeError'
  }
}

export class InvalidCategoryNameError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Category name is required and must not exceed 255 characters',
      { name: { required: true, maxLength: 255 } }
    )
    this.name = 'InvalidCategoryNameError'
  }
}

export class CategoryValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'CategoryValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class CategoryInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Category cannot be deleted as it is being used by ${usageCount} products`,
      { rule: 'category_in_use', categoryId: id, usageCount }
    )
    this.name = 'CategoryInUseError'
  }
}

export class CannotDeleteRootCategoryError extends BusinessRuleError {
  constructor() {
    super(
      'Root categories cannot be deleted',
      { rule: 'root_category_deletion' }
    )
    this.name = 'CannotDeleteRootCategoryError'
  }
}

export class CannotDeactivateCategoryWithProductsError extends BusinessRuleError {
  constructor(id: string, productCount: number) {
    super(
      `Cannot deactivate category with ${productCount} active products`,
      { rule: 'deactivate_with_products', categoryId: id, productCount }
    )
    this.name = 'CannotDeactivateCategoryWithProductsError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class CategoryCreateFailedError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to create category',
      { code: 'CATEGORY_CREATE_FAILED', context: { error } }
    )
    this.name = 'CategoryCreateFailedError'
  }
}

export class CategoryUpdateFailedError extends DatabaseError {
  constructor(id: string, error?: string) {
    super(
      `Failed to update category ${id}`,
      { code: 'CATEGORY_UPDATE_FAILED', context: { categoryId: id, error } }
    )
    this.name = 'CategoryUpdateFailedError'
  }
}

export class CategoryDeleteFailedError extends DatabaseError {
  constructor(id: string, error?: string) {
    super(
      `Failed to delete category ${id}`,
      { code: 'CATEGORY_DELETE_FAILED', context: { categoryId: id, error } }
    )
    this.name = 'CategoryDeleteFailedError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const CategoryErrors = {
  NOT_FOUND: (id?: string) => new CategoryNotFoundError(id),
  CODE_EXISTS: (code: string) => new CategoryCodeExistsError(code),
  NAME_EXISTS: (name: string) => new CategoryNameExistsError(name),
  INVALID_CODE: (message?: string) => new InvalidCategoryCodeError(message),
  INVALID_NAME: (message?: string) => new InvalidCategoryNameError(message),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new CategoryValidationError(message, details),
  IN_USE: (id: string, usageCount?: number) => new CategoryInUseError(id, usageCount || 0),
  DELETE_ROOT: () => new CannotDeleteRootCategoryError(),
  DEACTIVATE_WITH_PRODUCTS: (id: string, count: number) => 
    new CannotDeactivateCategoryWithProductsError(id, count),
  CREATE_FAILED: (error?: string) => new CategoryCreateFailedError(error),
  UPDATE_FAILED: (id: string, error?: string) => new CategoryUpdateFailedError(id, error),
  DELETE_FAILED: (id: string, error?: string) => new CategoryDeleteFailedError(id, error),
  
  // Additional error factories for compatibility
  ALREADY_EXISTS: (name: string) => new CategoryAlreadyExistsError(name),
}

