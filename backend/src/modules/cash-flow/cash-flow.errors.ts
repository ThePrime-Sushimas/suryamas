import { 
  NotFoundError, 
  ConflictError, 
  BusinessRuleError 
} from '../../utils/errors.base'

export class PeriodNotFoundError extends NotFoundError {
  constructor(id?: string) {
    super('period', id)
    this.name = 'PeriodNotFoundError'
  }
}

export class PeriodAlreadyExistsError extends ConflictError {
  constructor(date: string) {
    super(
      `A period starting on ${date} already exists for this bank account.`,
      { conflictType: 'duplicate', periodStart: date }
    )
    this.name = 'PeriodAlreadyExistsError'
  }
}

export class InvalidPeriodDatesError extends BusinessRuleError {
  constructor(start: string, end: string) {
    super(
      `Invalid period dates: start ${start} must be before end ${end}`,
      { rule: 'period_date_validation', start, end }
    )
    this.name = 'InvalidPeriodDatesError'
  }
}
