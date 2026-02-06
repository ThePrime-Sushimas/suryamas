/**
 * Metric Units Error Classes
 * Module-specific error classes untuk metric-units operations
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

export class MetricUnitError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'MetricUnitError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class MetricUnitNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('metric_unit', id)
    this.name = 'MetricUnitNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class MetricUnitCodeExistsError extends ConflictError {
  constructor(code: string) {
    super(
      `Metric unit with code '${code}' already exists`,
      { conflictType: 'duplicate', code }
    )
    this.name = 'MetricUnitCodeExistsError'
  }
}

export class MetricUnitNameExistsError extends ConflictError {
  constructor(name: string) {
    super(
      `Metric unit with name '${name}' already exists`,
      { conflictType: 'duplicate', name }
    )
    this.name = 'MetricUnitNameExistsError'
  }
}

export class DuplicateMetricUnitError extends ConflictError {
  constructor(metricType?: string, unitName?: string) {
    const detail = metricType && unitName ? `${metricType} - ${unitName}` : ''
    super(
      `Duplicate metric unit${detail ? `: ${detail}` : ''}`,
      { conflictType: 'duplicate', metricType, unitName }
    )
    this.name = 'DuplicateMetricUnitError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidMetricUnitCodeError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Metric unit code must not exceed 20 characters',
      { code: { maxLength: 20 } }
    )
    this.name = 'InvalidMetricUnitCodeError'
  }
}

export class InvalidMetricUnitNameError extends ValidationError {
  constructor(message?: string) {
    super(
      message || 'Metric unit name is required and must not exceed 100 characters',
      { name: { required: true, maxLength: 100 } }
    )
    this.name = 'InvalidMetricUnitNameError'
  }
}

export class MetricUnitValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'MetricUnitValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class MetricUnitInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Metric unit cannot be deleted as it is being used`,
      { rule: 'metric_unit_in_use', metricUnitId: id, usageCount }
    )
    this.name = 'MetricUnitInUseError'
  }
}

export class CannotDeleteDefaultMetricUnitError extends BusinessRuleError {
  constructor(unitName: string) {
    super(
      `Cannot delete default metric unit '${unitName}'`,
      { rule: 'default_metric_unit_deletion', unitName }
    )
    this.name = 'CannotDeleteDefaultMetricUnitError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class MetricUnitOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} metric unit`,
      { code: `METRIC_UNIT_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'MetricUnitOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const MetricUnitErrors = {
  NOT_FOUND: (id?: string) => new MetricUnitNotFoundError(id),
  CODE_EXISTS: (code: string) => new MetricUnitCodeExistsError(code),
  NAME_EXISTS: (name: string) => new MetricUnitNameExistsError(name),
  INVALID_CODE: (message?: string) => new InvalidMetricUnitCodeError(message),
  INVALID_NAME: (message?: string) => new InvalidMetricUnitNameError(message),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new MetricUnitValidationError(message, details),
  IN_USE: (id: string, usageCount?: number) => 
    new MetricUnitInUseError(id, usageCount || 0),
  DELETE_DEFAULT: (name: string) => new CannotDeleteDefaultMetricUnitError(name),
  CREATE_FAILED: (error?: string) => new MetricUnitOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new MetricUnitOperationError('update', error),
  DELETE_FAILED: (error?: string) => new MetricUnitOperationError('delete', error),
}

