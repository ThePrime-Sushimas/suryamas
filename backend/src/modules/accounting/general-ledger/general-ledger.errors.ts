import { BusinessRuleError, NotFoundError } from '../../../utils/errors.base'

export class InvalidDateRangeError extends BusinessRuleError {
  constructor() {
    super('date_from harus sebelum atau sama dengan date_to')
  }
}

export class AccountRequiredError extends BusinessRuleError {
  constructor() {
    super('account_id wajib diisi')
  }
}

export class AccountNotFoundError extends NotFoundError {
  constructor() {
    super('Akun')
  }
}

export const GeneralLedgerErrors = {
  INVALID_DATE_RANGE: () => new InvalidDateRangeError(),
  ACCOUNT_REQUIRED: () => new AccountRequiredError(),
  ACCOUNT_NOT_FOUND: () => new AccountNotFoundError(),
}
