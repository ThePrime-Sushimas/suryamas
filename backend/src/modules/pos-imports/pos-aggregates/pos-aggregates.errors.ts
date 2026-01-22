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
   * Database error
   */
  DATABASE_ERROR: (message: string, error: any) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_DATABASE_ERROR',
      message,
      500,
      { original_error: error?.message || error }
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
   * Company is inactive
   */
  COMPANY_INACTIVE: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_COMPANY_INACTIVE',
      `Company with ID '${id}' is inactive or closed`,
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
   * Branch is inactive
   */
  BRANCH_INACTIVE: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_BRANCH_INACTIVE',
      `Branch with ID '${id}' is inactive`,
      400,
      { branch_id: id }
    ),

  /**
   * Payment method not found
   */
  PAYMENT_METHOD_NOT_FOUND: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_PAYMENT_METHOD_NOT_FOUND',
      `Payment method with ID '${id}' not found`,
      400,
      { payment_method_id: id }
    ),

  /**
   * Payment method is inactive
   */
  PAYMENT_METHOD_INACTIVE: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_PAYMENT_METHOD_INACTIVE',
      `Payment method with ID '${id}' is inactive`,
      400,
      { payment_method_id: id }
    ),

  /**
   * Invalid status transition
   */
  INVALID_STATUS_TRANSITION: (currentStatus: string, newStatus: string, reason?: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_INVALID_STATUS_TRANSITION',
      reason || `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      400,
      { current_status: currentStatus, new_status: newStatus }
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
   * Cannot delete completed transaction
   */
  CANNOT_DELETE_COMPLETED: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_CANNOT_DELETE_COMPLETED',
      `Cannot delete transaction '${id}' with status COMPLETED`,
      400,
      { transaction_id: id }
    ),

  /**
   * Transaction already active (not deleted)
   */
  ALREADY_ACTIVE: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_ALREADY_ACTIVE',
      `Transaction '${id}' is already active`,
      400,
      { transaction_id: id }
    ),

  /**
   * Transaction already reconciled
   */
  ALREADY_RECONCILED: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_ALREADY_RECONCILED',
      `Transaction '${id}' is already reconciled`,
      400,
      { transaction_id: id }
    ),

  /**
   * No journal assigned to transaction
   */
  NO_JOURNAL_ASSIGNED: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_NO_JOURNAL_ASSIGNED',
      `No journal has been assigned to transaction '${id}'`,
      400,
      { transaction_id: id }
    ),

  /**
   * Journal already assigned
   */
  JOURNAL_ALREADY_ASSIGNED: (id: string) =>
    new AggregatedTransactionError(
      'AGGREGATED_TRANSACTION_JOURNAL_ALREADY_ASSIGNED',
      `Transaction '${id}' already has a journal assigned`,
      400,
      { transaction_id: id }
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
