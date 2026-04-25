import { NotFoundError, ConflictError, BusinessRuleError, DatabaseError } from '../../../utils/errors.base'

export class BankMutationEntryNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('bank_mutation_entry', id)
  }
}

export class BankMutationEntryAlreadyReconciledError extends ConflictError {
  constructor(statementId: string) {
    super(
      `Bank statement '${statementId}' sudah memiliki mutation entry`,
      { conflictType: 'duplicate', statementId }
    )
  }
}

export class BankMutationEntryAlreadyVoidedError extends BusinessRuleError {
  constructor(id: string) {
    super(
      `Mutation entry '${id}' sudah di-void`,
      { rule: 'already_voided', entryId: id }
    )
  }
}

export class BankMutationEntryStatementAlreadyMatchedError extends BusinessRuleError {
  constructor(statementId: string) {
    super(
      `Bank statement '${statementId}' sudah di-reconcile dengan sumber lain (POS/Cash Deposit/Settlement)`,
      { rule: 'statement_already_matched', statementId }
    )
  }
}

export class BankMutationEntryDatabaseError extends DatabaseError {
  constructor(operation: string, error?: string) {
    super(
      `Gagal ${operation} bank mutation entry`,
      { code: `BME_${operation.toUpperCase()}_FAILED`, context: { operation, error } }
    )
  }
}
