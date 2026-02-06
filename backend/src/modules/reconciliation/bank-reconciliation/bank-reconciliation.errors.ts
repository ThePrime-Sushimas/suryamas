/**
 * Bank Reconciliation Error Classes
 * Module-specific error classes untuk bank-reconciliation operations
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

export class BankReconciliationError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'BankReconciliationError'
  }
}

// ============================================================================
// NOT FOUND ERRORS
// ============================================================================

export class ReconciliationNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('reconciliation', id)
    this.name = 'ReconciliationNotFoundError'
  }
}

export class ReconciliationSessionNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('reconciliation_session', id)
    this.name = 'ReconciliationSessionNotFoundError'
  }
}

export class ReconciliationItemNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('reconciliation_item', id)
    this.name = 'ReconciliationItemNotFoundError'
  }
}

// ============================================================================
// CONFLICT ERRORS
// ============================================================================

export class ReconciliationDuplicateItemError extends ConflictError {
  constructor(itemId: string) {
    super(
      `Item '${itemId}' has already been reconciled`,
      { conflictType: 'duplicate', itemId }
    )
    this.name = 'ReconciliationDuplicateItemError'
  }
}

export class ReconciliationAlreadyProcessedError extends ConflictError {
  constructor(id: string) {
    super(
      `Reconciliation '${id}' has already been processed`,
      { conflictType: 'duplicate', reconciliationId: id }
    )
    this.name = 'ReconciliationAlreadyProcessedError'
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class InvalidReconciliationStatusError extends ValidationError {
  constructor(status: string, validStatuses: string[]) {
    super(
      `Invalid reconciliation status: ${status}`,
      { status, validStatuses }
    )
    this.name = 'InvalidReconciliationStatusError'
  }
}

export class InvalidReconciliationDateRangeError extends ValidationError {
  constructor(startDate: string, endDate: string) {
    super(
      `Invalid date range: start date must be before end date`,
      { startDate, endDate }
    )
    this.name = 'InvalidReconciliationDateRangeError'
  }
}

export class InvalidAmountMismatchError extends ValidationError {
  constructor(transactionAmount: number, bankAmount: number) {
    super(
      `Amount mismatch: transaction (${transactionAmount}) vs bank (${bankAmount})`,
      { transactionAmount, bankAmount }
    )
    this.name = 'InvalidAmountMismatchError'
  }
}

export class ReconciliationValidationError extends ValidationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
    this.name = 'ReconciliationValidationError'
  }
}

// ============================================================================
// BUSINESS RULE ERRORS
// ============================================================================

export class ReconciliationAlreadyCompletedError extends BusinessRuleError {
  constructor(id: string) {
    super(
      `Reconciliation '${id}' is already completed`,
      { rule: 'reconciliation_completed', reconciliationId: id }
    )
    this.name = 'ReconciliationAlreadyCompletedError'
  }
}

export class ReconciliationCannotBeReopenedError extends BusinessRuleError {
  constructor(id: string) {
    super(
      `Reconciliation '${id}' cannot be reopened`,
      { rule: 'reconciliation_reopen', reconciliationId: id }
    )
    this.name = 'ReconciliationCannotBeReopenedError'
  }
}

export class ReconciliationInUseError extends BusinessRuleError {
  constructor(id: string, usageCount: number) {
    super(
      `Cannot delete reconciliation as it is being referenced by ${usageCount} records`,
      { rule: 'reconciliation_in_use', reconciliationId: id, usageCount }
    )
    this.name = 'ReconciliationInUseError'
  }
}

export class BankAccountMismatchError extends BusinessRuleError {
  constructor(expectedAccountId: string, actualAccountId: string) {
    super(
      `Bank account mismatch: expected '${expectedAccountId}', got '${actualAccountId}'`,
      { rule: 'bank_account_mismatch', expectedAccountId, actualAccountId }
    )
    this.name = 'BankAccountMismatchError'
  }
}

export class DateRangeOverlapError extends BusinessRuleError {
  constructor(existingRange: { startDate: string; endDate: string }) {
    super(
      `Date range overlaps with existing reconciliation`,
      { rule: 'date_range_overlap', existingRange }
    )
    this.name = 'DateRangeOverlapError'
  }
}

// ============================================================================
// DATABASE ERRORS
// ============================================================================

export class ReconciliationOperationError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Failed to ${operation} reconciliation`,
      { code: `RECONCILIATION_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
    this.name = 'ReconciliationOperationError'
  }
}

export class ReconciliationAutoMatchError extends DatabaseError {
  constructor(error?: string) {
    super(
      'Failed to auto-match transactions',
      { code: 'RECONCILIATION_AUTO_MATCH_FAILED', context: { error } }
    )
    this.name = 'ReconciliationAutoMatchError'
  }
}

export class ReconciliationProcessingError extends DatabaseError {
  constructor(phase: string, error?: string) {
    super(
      `Reconciliation processing failed at phase: ${phase}`,
      { code: 'RECONCILIATION_PROCESSING_FAILED', context: { phase, error } }
    )
    this.name = 'ReconciliationProcessingError'
  }
}

// ============================================================================
// ERROR FACTORY (CONVENIENCE METHODS)
// ============================================================================

export const BankReconciliationErrors = {
  NOT_FOUND: (id?: string) => new ReconciliationNotFoundError(id),
  SESSION_NOT_FOUND: (id?: string) => new ReconciliationSessionNotFoundError(id),
  ITEM_NOT_FOUND: (id?: string) => new ReconciliationItemNotFoundError(id),
  
  // Conflict
  DUPLICATE_ITEM: (itemId: string) => new ReconciliationDuplicateItemError(itemId),
  ALREADY_PROCESSED: (id: string) => new ReconciliationAlreadyProcessedError(id),
  
  // Validation
  INVALID_STATUS: (status: string, validStatuses: string[]) => 
    new InvalidReconciliationStatusError(status, validStatuses),
  INVALID_DATE_RANGE: (startDate: string, endDate: string) => 
    new InvalidReconciliationDateRangeError(startDate, endDate),
  AMOUNT_MISMATCH: (transactionAmount: number, bankAmount: number) => 
    new InvalidAmountMismatchError(transactionAmount, bankAmount),
  VALIDATION_ERROR: (message: string, details?: Record<string, unknown>) => 
    new ReconciliationValidationError(message, details),
  
  // Business rules
  ALREADY_COMPLETED: (id: string) => new ReconciliationAlreadyCompletedError(id),
  CANNOT_REOPEN: (id: string) => new ReconciliationCannotBeReopenedError(id),
  IN_USE: (id: string, usageCount?: number) => 
    new ReconciliationInUseError(id, usageCount || 0),
  BANK_ACCOUNT_MISMATCH: (expected: string, actual: string) => 
    new BankAccountMismatchError(expected, actual),
  DATE_RANGE_OVERLAP: (existingRange: { startDate: string; endDate: string }) => 
    new DateRangeOverlapError(existingRange),
  
  // Database
  CREATE_FAILED: (error?: string) => new ReconciliationOperationError('create', error),
  UPDATE_FAILED: (error?: string) => new ReconciliationOperationError('update', error),
  DELETE_FAILED: (error?: string) => new ReconciliationOperationError('delete', error),
  AUTO_MATCH_FAILED: (error?: string) => new ReconciliationAutoMatchError(error),
  PROCESSING_FAILED: (phase: string, error?: string) => 
    new ReconciliationProcessingError(phase, error),
  
  // Additional error factories for compatibility (with optional arguments)
  ALREADY_RECONCILED: () => new ReconciliationAlreadyProcessedError('already_reconciled'),
}

// ============================================================================
// ADDITIONAL ERROR CLASSES (FOR COMPATIBILITY)
// ============================================================================

// Alias for BankReconciliationError
export class ReconciliationError extends BankReconciliationError {
  constructor(code: string, message: string, statusCode: number = 400) {
    super(code, message, statusCode)
    this.name = 'ReconciliationError'
  }
}

// Database connection errors
export class DatabaseConnectionError extends DatabaseError {
  constructor(...args: [string] | [string, string]) {
    // Handle both one-arg and two-arg calls
    // Usage: DatabaseConnectionError(error) or DatabaseConnectionError(operation, error)
    let operation: string | undefined
    let error: string | undefined
    
    if (args.length === 2) {
      operation = args[0]
      error = args[1]
    } else {
      error = args[0]
    }
    
    const message = operation ? `Database connection failed: ${operation}` : 'Database connection failed'
    super(
      message,
      { code: 'DATABASE_CONNECTION_ERROR', context: { operation, error } }
    )
    this.name = 'DatabaseConnectionError'
  }
}

// Statement errors
export class StatementNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('bank_statement', id)
    this.name = 'StatementNotFoundError'
  }
}

export class FetchStatementError extends DatabaseError {
  constructor(...args: [string] | [string, string]) {
    // Handle both one-arg and two-arg calls
    // Usage: FetchStatementError(error) or FetchStatementError(id, error)
    let id: string | undefined
    let error: string | undefined
    
    if (args.length === 2) {
      id = args[0]
      error = args[1]
    } else {
      error = args[0]
    }
    
    const message = id ? `Failed to fetch bank statement: ${id}` : 'Failed to fetch bank statement'
    super(
      message,
      { code: 'FETCH_STATEMENT_ERROR', context: { id, error } }
    )
    this.name = 'FetchStatementError'
  }
}

// Match errors
export class NoMatchFoundError extends ValidationError {
  constructor(details?: Record<string, unknown>) {
    super('No matching transaction found', details)
    this.name = 'NoMatchFoundError'
  }
}

export class AlreadyReconciledError extends ConflictError {
  constructor(itemId: string) {
    super(
      `Item '${itemId}' has already been reconciled`,
      { conflictType: 'duplicate', itemId }
    )
    this.name = 'AlreadyReconciledError'
  }
}

export class DifferenceThresholdExceededError extends ValidationError {
  constructor(threshold: number, actual: number) {
    super(
      `Difference threshold exceeded. Maximum allowed: ${threshold}, actual: ${actual}`,
      { threshold, actual }
    )
    this.name = 'DifferenceThresholdExceededError'
  }
}

