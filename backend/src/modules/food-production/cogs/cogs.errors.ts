import { NotFoundError, BusinessRuleError } from '../../../utils/errors.base'

export class CogsCalculationNotFoundError extends NotFoundError {
  constructor(id?: string) { super(id ? `COGS calculation ${id} not found` : 'COGS calculation not found') }
}

export class CogsNoSalesDataError extends BusinessRuleError {
  constructor(periodStart: string, periodEnd: string) {
    super(`No sales data found for period ${periodStart} to ${periodEnd}`)
  }
}

export class CogsAlreadyJournaledError extends BusinessRuleError {
  constructor() { super('This COGS calculation has already been journaled') }
}

export class CogsPeriodNotOpenError extends BusinessRuleError {
  constructor() { super('Cannot finalize COGS — fiscal period is not open') }
}
