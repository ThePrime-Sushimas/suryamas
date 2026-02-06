/**
 * POS Aggregates Error Classes
 * Module-specific error classes untuk pos-aggregates operations
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
} from '../../../utils/errors.base'

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class PosAggregateError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PosAggregateError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class PosAggregateNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('pos_aggregate', id)
    this.name = 'PosAggregateNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class PosAggregateDuplicatePeriodError extends ConflictError {
  constructor(periodKey: string) {
    super(
      `Aggregate for period '${periodKey}' already exists`,
      { conflictType: 'duplicate', periodKey }
    )
    this.name = 'PosAggregateDuplicatePeriodError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class PosAggregateInvalidPeriodError extends ValidationError {
  constructor(period: string) {
    super(
      `Invalid aggregation period: ${period}`,
      { period }
    )
    this.name = 'PosAggregateInvalidPeriodError'
  }
}

export class PosAggregateInvalidDateRangeError extends ValidationError {
  constructor(startDate: string, endDate: string) {
    super(
      `Invalid date range: ${startDate} to ${endDate}`,
      { startDate, endDate }
    )
    this.name = 'PosAggregateInvalidDateRangeError'
  }
}

export class PosAggregateValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'PosAggregateValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class PosAggregateAlreadyProcessedError extends BusinessRuleError {
  constructor(periodKey: string) {
    super(
      `Aggregate for period '${periodKey}' has already been processed`,
      { rule: 'aggregate_already_processed', periodKey }
    )
    this.name = 'PosAggregateAlreadyProcessedError'
  }
}

export class PosAggregateInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Cannot delete aggregate as it is being referenced by ${usageCount} records`,
      { rule: 'aggregate_in_use', aggregateId: id, usageCount }
    )
    this.name = 'PosAggregateInUseError'
  }
}

export class PosAggregateInvalidStatusError extends BusinessRuleError {
  constructor(status: string, validStatuses?: string[]) {
    super(
      `Invalid status: ${status}`,
      { rule: 'invalid_status', status, validStatuses }
    )
    this.name = 'PosAggregateInvalidStatusError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class PosAggregateGenerationError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to generate POS aggregate',
      { code: 'POS_AGGREGATE_GENERATION_FAILED', context: { error } }
    )
    this.name = 'PosAggregateGenerationError'
  }
}

export class PosAggregateOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} POS aggregate`,
      { code: `POS_AGGREGATE_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'PosAggregateOperationError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const PosAggregateErrors = {
  NOT_FOUND: (id?: string) => new PosAggregateNotFoundError(id),
  
  // Conflict
  DUPLICATE_PERIOD: (periodKey: string) => new PosAggregateDuplicatePeriodError(periodKey),
  
  // Validation
  INVALID_PERIOD: (period: string) => new PosAggregateInvalidPeriodError(period),
  INVALID_DATE_RANGE: (startDate: string, endDate: string) => 
    new PosAggregateInvalidDateRangeError(startDate, endDate),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new PosAggregateValidationError(message, details),
  
  // Business rules
  ALREADY_PROCESSED: (periodKey: string) => new PosAggregateAlreadyProcessedError(periodKey),
  IN_USE: (id: string, usageCount?: number) => new PosAggregateInUseError(id, usageCount || 0),
  
  // Database
  GENERATION_FAILED: (error?: string) => new PosAggregateGenerationError(error),
  CREATE_FAILED: (error?: string) => new PosAggregateOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new PosAggregateOperationError('update', error),
  DELETE_FAILED: (error?: string) => new PosAggregateOperationError('delete', error),
}

// ============================================================================
// ADDITIONAL ERROR CLASSES (FOR COMPATIBILITY)
// ============================================================================

// Static error factory methods for compatibility
export const AggregatedTransactionError = {
  DATABASE_ERROR: (message?: string, error?: any) => new PosAggregateGenerationError(error?.message || message),
  BRANCH_NOT_FOUND: (id?: string) => new PosAggregateNotFoundError(id),
  BRANCH_INACTIVE: (id: string) => new PosAggregateValidationError(`Branch ${id} is inactive`, { branchId: id }),
  PAYMENT_METHOD_NOT_FOUND: (id?: string) => new PosAggregateNotFoundError(id),
  PAYMENT_METHOD_INACTIVE: (id: string) => new PosAggregateValidationError(`Payment method ${id} is inactive`, { paymentMethodId: id }),
  INVALID_STATUS_TRANSITION: (currentStatus: string, targetStatus: string) => 
    new PosAggregateInvalidStatusError(currentStatus),
DUPLICATE_SOURCE: (periodKey?: string) => new PosAggregateDuplicatePeriodError(periodKey || 'unknown'),
  NOT_FOUND: (id?: string) => new PosAggregateNotFoundError(id),
  VERSION_CONFLICT: (id?: string, expected?: number, actual?: number) => new ConflictError(
    'Version conflict', 
    { conflictType: 'concurrency', aggregateId: id, expectedVersion: expected, actualVersion: actual }
  ),
  CANNOT_DELETE_COMPLETED: (id?: string) => new PosAggregateAlreadyProcessedError(id || 'completed'),
  ALREADY_ACTIVE: (id: string) => new PosAggregateAlreadyProcessedError(id),
  ALREADY_RECONCILED: (id: string) => new PosAggregateAlreadyProcessedError(id),
NO_JOURNAL_ASSIGNED: () => new PosAggregateValidationError('No journal entry assigned'),
  JOURNAL_ALREADY_ASSIGNED: (id: string) => new PosAggregateValidationError(`Journal already assigned to ${id}`, { aggregateId: id }),
}

// Alias for compatibility
export const AggregatedTransactionErrors = AggregatedTransactionError

