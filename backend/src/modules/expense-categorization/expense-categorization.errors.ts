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

export class AlreadyCategorizedError extends BusinessRuleError {
  constructor(statementId: string) {
    super(`Statement ${statementId} already has a journal`, { rule: 'already_journaled', statementId })
    this.name = 'AlreadyCategorizedError'
  }
}
