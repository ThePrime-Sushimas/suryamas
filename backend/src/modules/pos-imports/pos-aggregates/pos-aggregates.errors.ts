
export class AggregatedTransactionError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AggregatedTransactionError'
  }
}

export const AggregatedTransactionErrors = {
  /**
   * Transaction not found
   */
  NOT_FOUND: (id?: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_NOT_FOUND',
      id ? `Aggregated transaction with ID '${id}' not found` : 'Aggregated transaction not found',
      404
    ),

  /**
   * Duplicate source (source_type, source_id, source_ref)
   */
  DUPLICATE_SOURCE: (sourceType: string, sourceId: string, sourceRef: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_DUPLICATE_SOURCE',
      `Transaction already exists for source_type='${sourceType}', source_id='${sourceId}', source_ref='${sourceRef}'`,
      409,
      { source_type: sourceType, source_id: sourceId, source_ref: sourceRef }
    ),

  /**
   * Invalid net amount calculation
   */
  INVALID_NET_AMOUNT: (calculated: number, provided: number) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_INVALID_NET_AMOUNT',
      `Net amount mismatch. Calculated: ${calculated}, Provided: ${provided}`,
      400,
      { calculated_net_amount: calculated, provided_net_amount: provided }
    ),

  /**
   * Payment method not found
   */
  PAYMENT_METHOD_NOT_FOUND: (id: number) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_PAYMENT_METHOD_NOT_FOUND',
      `Payment method with ID '${id}' not found`,
      400,
      { payment_method_id: id }
    ),

  /**
   * Company not found
   */
  COMPANY_NOT_FOUND: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_COMPANY_NOT_FOUND',
      `Company with ID '${id}' not found`,
      400,
      { company_id: id }
    ),

  /**
   * Branch not found
   */
  BRANCH_NOT_FOUND: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_BRANCH_NOT_FOUND',
      `Branch with ID '${id}' not found`,
      400,
      { branch_id: id }
    ),

  /**
   * Journal not found
   */
  JOURNAL_NOT_FOUND: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_JOURNAL_NOT_FOUND',
      `Journal with ID '${id}' not found`,
      400,
      { journal_id: id }
    ),

  /**
   * Invalid status transition
   */
  INVALID_STATUS_TRANSITION: (currentStatus: string, newStatus: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_INVALID_STATUS_TRANSITION',
      `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      400,
      { current_status: currentStatus, new_status: newStatus }
    ),

  /**
   * Cannot update reconciled transaction
   */
  CANNOT_UPDATE_RECONCILED: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_CANNOT_UPDATE_RECONCILED',
      `Cannot update transaction '${id}' as it has been reconciled`,
      400,
      { transaction_id: id }
    ),

  /**
   * Cannot delete transaction with journal
   */
  CANNOT_DELETE_WITH_JOURNAL: (id: string, journalId: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_CANNOT_DELETE_WITH_JOURNAL',
      `Cannot delete transaction '${id}' as it has associated journal '${journalId}'`,
      400,
      { transaction_id: id, journal_id: journalId }
    ),

  /**
   * Aggregation failed
   */
  AGGREGATION_FAILED: (posImportId: string, reason: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_AGGREGATION_FAILED',
      `Failed to aggregate transactions from import '${posImportId}': ${reason}`,
      500,
      { pos_import_id: posImportId }
    ),

  /**
   * No transactions to aggregate
   */
  NO_TRANSACTIONS_TO_AGGREGATE: (posImportId: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_NO_TRANSACTIONS',
      `No transactions found to aggregate from import '${posImportId}'`,
      400,
      { pos_import_id: posImportId }
    ),

  /**
   * Journal generation failed
   */
  JOURNAL_GENERATION_FAILED: (reason: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_JOURNAL_GENERATION_FAILED',
      `Failed to generate journal: ${reason}`,
      500,
      { reason }
    ),

  /**
   * Batch reconciliation failed
   */
  BATCH_RECONCILIATION_FAILED: (successCount: number, failedCount: number, errors: string[]) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_BATCH_RECONCILIATION_FAILED',
      `Batch reconciliation completed with ${successCount} success and ${failedCount} failures`,
      400,
      { success_count: successCount, failed_count: failedCount, errors }
    ),

  /**
   * Version conflict (optimistic locking)
   */
  VERSION_CONFLICT: (id: string, expectedVersion: number, actualVersion: number) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_VERSION_CONFLICT',
      `Transaction '${id}' was modified by another request. Expected version: ${expectedVersion}, Current version: ${actualVersion}`,
      409,
      { transaction_id: id, expected_version: expectedVersion, actual_version: actualVersion }
    ),

  /**
   * Invalid transaction date
   */
  INVALID_TRANSACTION_DATE: (date: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_INVALID_DATE',
      `Invalid transaction date: '${date}'`,
      400,
      { transaction_date: date }
    ),

  /**
   * Net amount must be non-negative
   */
  NET_AMOUNT_NEGATIVE: (amount: number) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_NEGATIVE_NET_AMOUNT',
      `Net amount cannot be negative: ${amount}`,
      400,
      { net_amount: amount }
    ),
}

