/**
 * Centralized configuration for the Bank Reconciliation module
 */

export interface ReconciliationConfig {
  amountTolerance: number;
  dateBufferDays: number;
  differenceThreshold: number;
  autoMatchBatchSize: number;
  maxRetries: number;
}

export function getReconciliationConfig(): ReconciliationConfig {
  return {
    amountTolerance: parseFloat(process.env.RECONCILIATION_AMOUNT_TOLERANCE || '0.01'),
    dateBufferDays: parseInt(process.env.RECONCILIATION_DATE_BUFFER_DAYS || '3'),
    differenceThreshold: parseFloat(process.env.RECONCILIATION_DIFFERENCE_THRESHOLD || '100'),
    autoMatchBatchSize: parseInt(process.env.RECONCILIATION_AUTO_MATCH_BATCH_SIZE || '500'),
    maxRetries: parseInt(process.env.RECONCILIATION_MAX_RETRIES || '3')
  };
}
