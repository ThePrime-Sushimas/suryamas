// backend/src/modules/pos-aggregates/pos-aggregates.errors.ts

import { NotFoundError, ConflictError, ValidationError, BusinessRuleError } from '../../utils/error-handler.util'

/**
 * Domain-specific error codes for pos-aggregates module
 */
export enum PosAggregatesErrorCode {
  // Validation & input
  VALIDATION_ERROR = 'POS_AGG_VALIDATION_ERROR',

  // Idempotency
  DUPLICATE_SOURCE = 'POS_AGG_DUPLICATE_SOURCE',

  // Mapping & reference integrity
  PAYMENT_METHOD_NOT_FOUND = 'POS_AGG_PAYMENT_METHOD_NOT_FOUND',

  // Versioning / concurrency
  VERSION_CONFLICT = 'POS_AGG_VERSION_CONFLICT',

  // Lifecycle & workflow
  INVALID_STATUS_TRANSITION = 'POS_AGG_INVALID_STATUS_TRANSITION',
  JOURNAL_ALREADY_LINKED = 'POS_AGG_JOURNAL_ALREADY_LINKED',
  FISCAL_PERIOD_CLOSED = 'POS_AGG_FISCAL_PERIOD_CLOSED',

  // Refund & split
  REFUND_AMOUNT_EXCEEDS = 'POS_AGG_REFUND_AMOUNT_EXCEEDS',
  REFUND_REQUIRES_APPROVAL = 'POS_AGG_REFUND_REQUIRES_APPROVAL',
  SPLIT_AMOUNT_MISMATCH = 'POS_AGG_SPLIT_AMOUNT_MISMATCH',

  // Batch & processing
  AGGREGATION_FAILED = 'POS_AGG_AGGREGATION_FAILED',
  BATCH_PROCESSING_ERROR = 'POS_AGG_BATCH_PROCESSING_ERROR',

  // Retrieval
  NOT_FOUND = 'POS_AGG_NOT_FOUND',

  // Reconciliation
  RECONCILIATION_MISMATCH = 'POS_AGG_RECONCILIATION_MISMATCH',

  // Catch-all
  INTERNAL_ERROR = 'POS_AGG_INTERNAL_ERROR',
}

// ==================== ERROR CLASSES ====================

export class PosAggregatesNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Aggregated transaction not found: ${id}`, { transactionId: id })
  }
}

export class PosAggregatesDuplicateSourceError extends ConflictError {
  constructor(sourceRef: string) {
    super(
      `Aggregated transaction already exists for source: ${sourceRef}`,
      { sourceRef }
    )
  }
}

export class PosAggregatesPaymentMethodNotFoundError extends BusinessRuleError {
  constructor(paymentMethodId: number, message?: string) {
    super(
      message || `Payment method not found or inactive: ${paymentMethodId}`,
      { paymentMethodId }
    )
  }
}

export class PosAggregatesFiscalPeriodClosedError extends BusinessRuleError {
  constructor(date: string) {
    super(`Accounting period is closed for date: ${date}`, { date })
  }
}

export class PosAggregatesInvalidStatusTransitionError extends BusinessRuleError {
  constructor(from: string, to: string) {
    super(`Invalid status transition from ${from} to ${to}`, { from, to })
  }
}

export class PosAggregatesJournalAlreadyLinkedError extends BusinessRuleError {
  constructor() {
    super('Aggregated transaction already linked to a journal')
  }
}

export class PosAggregatesVersionConflictError extends ConflictError {
  constructor(transactionId: string, expectedVersion: number) {
    super(
      `Version conflict for transaction ${transactionId}. Expected version: ${expectedVersion}`,
      { transactionId, expectedVersion }
    )
  }
}

// ==================== SPLIT / REFUND ====================

export class PosAggregatesSplitAmountMismatchError extends ValidationError {
  constructor(originalAmount: number, splitTotal: number) {
    super(
      `Split total (${splitTotal}) does not match original amount (${originalAmount})`,
      { originalAmount, splitTotal }
    )
  }
}

export class PosAggregatesRefundAmountExceedsError extends ValidationError {
  constructor(refundAmount: number, availableAmount: number) {
    super(
      `Refund amount (${refundAmount}) exceeds available amount (${availableAmount})`,
      { refundAmount, availableAmount }
    )
  }
}

export class PosAggregatesRefundRequiresApprovalError extends ValidationError {
  constructor(refundRequestId?: string) {
    super('Refund requires approval', { refundRequestId })
  }
}

// ==================== BATCH / AGGREGATION ====================

export class PosAggregatesAggregationFailedError extends BusinessRuleError {
  constructor(message = 'Aggregation process failed', details?: unknown) {
    super(message, details as Record<string, unknown>)
  }
}

export class PosAggregatesBatchError extends BusinessRuleError {
  constructor(
    successful: number,
    failed: number,
    errors: Array<{ sourceRef: string; error: string }>
  ) {
    super(
      `Batch processing completed with ${successful} success, ${failed} failed`,
      { successful, failed, errors }
    )
  }
}

// ==================== RECONCILIATION ====================

export class PosAggregatesReconciliationMismatchError extends ValidationError {
  constructor(details?: unknown) {
    super('Reconciliation mismatch detected', details as Record<string, unknown>)
  }
}

// ==================== INTERNAL ====================

export class PosAggregatesInternalError extends BusinessRuleError {
  constructor(message = 'Internal pos-aggregates error', details?: unknown) {
    super(message, details as Record<string, unknown>)
  }
}

