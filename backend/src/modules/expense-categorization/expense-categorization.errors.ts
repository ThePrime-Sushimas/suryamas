import { NotFoundError, ConflictError, BusinessRuleError } from '../../utils/errors.base'

export class RuleNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('expense_auto_rule', id)
    this.name = 'RuleNotFoundError'
  }
}

export class RuleDuplicateError extends ConflictError {
  constructor(pattern: string) {
    super(`Rule with pattern "${pattern}" already exists`, { conflictType: 'duplicate', pattern })
    this.name = 'RuleDuplicateError'
  }
}

export class NoEligibleStatementsError extends BusinessRuleError {
  constructor() {
    super('No eligible statements found — semua sudah dijurnal atau belum dikategorikan', { rule: 'no_eligible_statements' })
    this.name = 'NoEligibleStatementsError'
  }
}

export class MissingCoaMappingError extends BusinessRuleError {
  constructor(purposeCodes: string) {
    super(`Purpose ${purposeCodes} belum punya mapping COA lengkap. Setup di Accounting Purpose Accounts.`, { rule: 'missing_coa_mapping', purposeCodes })
    this.name = 'MissingCoaMappingError'
  }
}
