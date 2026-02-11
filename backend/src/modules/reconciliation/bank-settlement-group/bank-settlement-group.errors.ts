/**
 * Settlement Group Module Errors
 */

import { AppError, NotFoundError, ConflictError, BusinessRuleError } from "../../../utils/errors.base";

export class SettlementGroupNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('Settlement Group', { settlementGroupId: id });
  }
}

export class SettlementAggregateNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('Settlement Aggregate', { settlementAggregateId: id });
  }
}

export class DuplicateAggregateError extends ConflictError {
  constructor(aggregateId: string) {
    super(`Aggregate '${aggregateId}' sudah ada di settlement group lain`, { aggregateId, conflictType: 'duplicate' });
  }
}

export class AggregateAlreadyReconciledError extends ConflictError {
  constructor(aggregateId: string) {
    super(`Aggregate '${aggregateId}' sudah direconciled`, { aggregateId, conflictType: 'conflict' });
  }
}

export class StatementAlreadyReconciledError extends ConflictError {
  constructor(statementId: string) {
    super(`Bank statement '${statementId}' sudah direconciled`, { statementId, conflictType: 'conflict' });
  }
}

export class DifferenceThresholdExceededError extends BusinessRuleError {
  constructor(difference: number, percent: number, threshold: number) {
    super(
      `Difference ${difference} (${(percent * 100).toFixed(2)}%) melebihi threshold ${(threshold * 100).toFixed(2)}%. Gunakan override jika ingin melanjutkan.`,
      { difference, percent, threshold, rule: 'difference_threshold' }
    );
  }
}

export class SettlementAlreadyConfirmedError extends ConflictError {
  constructor(id: string) {
    super(`Settlement group '${id}' sudah dikonfirmasi`, { settlementGroupId: id, rule: 'already_confirmed', conflictType: 'conflict' });
  }
}

export class InvalidSettlementStatusError extends BusinessRuleError {
  constructor(status: string, validStatuses: string[]) {
    super(`Status settlement '${status}' tidak valid. Status yang valid: ${validStatuses.join(', ')}`, { status, validStatuses, rule: 'invalid_status' });
  }
}

export class CreateSettlementGroupError extends BusinessRuleError {
  constructor(operation: string, error: string) {
    super(`Gagal ${operation} settlement group: ${error}`, { operation, error, code: `SETTLEMENT_GROUP_${operation.toUpperCase()}_FAILED` });
  }
}

export class AggregateReconciledElsewhereError extends ConflictError {
  constructor(details?: string) {
    super(`Beberapa aggregate sudah di-reconciled dengan settlement group lain${details ? ': ' + details : ''}`, { 
      details, 
      conflictType: 'reconciled_elsewhere',
      code: 'AGGREGATE_RECONCILED_ELSEWHERE' 
    });
  }
}

