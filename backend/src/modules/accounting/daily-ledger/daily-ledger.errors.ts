import { BusinessRuleError } from '../../../utils/errors.base'

export class InvalidDateRangeError extends BusinessRuleError {
  constructor() {
    super('date_from harus sebelum atau sama dengan date_to')
  }
}

export const DailyLedgerErrors = {
  INVALID_DATE_RANGE: () => new InvalidDateRangeError(),
}
