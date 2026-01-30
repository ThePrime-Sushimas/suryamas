/**
 * Custom error classes for the Bank Reconciliation module
 */

export class ReconciliationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ReconciliationError';
  }
}

export class AlreadyReconciledError extends ReconciliationError {
  constructor(statementId: string) {
    super(`Statement ${statementId} is already reconciled`, 'ALREADY_RECONCILED');
  }
}

export class DifferenceThresholdExceededError extends ReconciliationError {
  constructor(amount: number, threshold: number) {
    super(
      `Amount difference ${amount} exceeds threshold ${threshold}`,
      'DIFFERENCE_THRESHOLD_EXCEEDED'
    );
  }
}

export class NoMatchFoundError extends ReconciliationError {
  constructor(statementId: string) {
    super(`No match found for statement ${statementId}`, 'NO_MATCH_FOUND');
  }
}
