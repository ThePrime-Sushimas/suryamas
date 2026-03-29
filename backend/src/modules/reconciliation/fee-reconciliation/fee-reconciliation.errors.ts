/**
 * Fee Reconciliation Errors
 * Domain-specific errors for fee reconciliation
 */

import { AppError } from '../../../utils/errors.base'

/**
 * Base class for fee reconciliation errors
 */
export abstract class FeeReconciliationError extends AppError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, any> = {}
  ) {
    super(message, 400, code, context)
  }
}

/**
 * Payment method fee configuration not found
 */
export class FeeConfigNotFoundError extends FeeReconciliationError {
  constructor(paymentMethodId: number) {
    super(
      `Fee configuration not found for payment method ${paymentMethodId}`,
      'FEE_CONFIG_NOT_FOUND',
      { paymentMethodId }
    )
  }
}

/**
 * Reconciliation already approved or rejected
 */
export class ReconciliationAlreadyProcessedError extends FeeReconciliationError {
  constructor(reconciliationId: string) {
    super(
      `Reconciliation ${reconciliationId} already processed`,
      'RECONCILIATION_ALREADY_PROCESSED',
      { reconciliationId }
    )
  }
}

/**
 * Invalid reconciliation ID format (expected: paymentMethodId_date)
 */
export class InvalidReconciliationIdError extends FeeReconciliationError {
  constructor(reconciliationId: string) {
    super(
      `Invalid reconciliation ID format: ${reconciliationId}`,
      'INVALID_RECONCILIATION_ID',
      { reconciliationId }
    )
  }
}

/**
 * No aggregated transactions found for the given date/payment method
 */
export class NoAggregatedTransactionsError extends FeeReconciliationError {
  constructor(paymentMethodId: number, date: string) {
    super(
      `No aggregated transactions found for payment method ${paymentMethodId} on ${date}`,
      'NO_AGGREGATED_TRANSACTIONS',
      { paymentMethodId, date }
    )
  }
}

/**
 * Discrepancy exceeds tolerance threshold
 */
export class DiscrepancyExceedsToleranceError extends FeeReconciliationError {
  constructor(
    expected: number,
    actual: number,
    tolerance: number,
    discrepancy: number
  ) {
    super(
      `Fee discrepancy exceeds tolerance threshold`,
      'DISCREPANCY_EXCEEDS_TOLERANCE',
      { expected, actual, tolerance, discrepancy }
    )
  }
}

/**
 * Cannot calculate fee for zero gross amount
 */
export class ZeroGrossAmountError extends FeeReconciliationError {
  constructor(paymentMethodId: number) {
    super(
      `Cannot reconcile zero gross amount`,
      'ZERO_GROSS_AMOUNT',
      { paymentMethodId }
    )
  }
}

/**
 * Batch reconciliation failed for one or more payment methods
 */
export class BatchReconciliationPartialFailureError extends FeeReconciliationError {
  constructor(failedCount: number, totalCount: number) {
    super(
      `Batch reconciliation failed for ${failedCount}/${totalCount} payment methods`,
      'BATCH_RECONCILIATION_PARTIAL_FAILURE',
      { failedCount, totalCount }
    )
  }
}

// ========================================
// Convenience exports
// ========================================

export const feeReconciliationErrors = {
  FeeConfigNotFoundError,
  ReconciliationAlreadyProcessedError,
  InvalidReconciliationIdError,
  NoAggregatedTransactionsError,
  DiscrepancyExceedsToleranceError,
  ZeroGrossAmountError,
  BatchReconciliationPartialFailureError,
}

