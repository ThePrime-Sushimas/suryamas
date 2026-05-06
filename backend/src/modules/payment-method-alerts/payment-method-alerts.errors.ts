import { NotFoundError, BusinessRuleError } from '../../utils/errors.base'

export class AlertNotFoundError extends NotFoundError {
  constructor(id: string) { super(`Alert ${id} tidak ditemukan`) }
}

export class DuplicateAlertError extends BusinessRuleError {
  constructor() { super('Alert untuk payment method ini sudah ada') }
}

export const PaymentMethodAlertErrors = {
  NOT_FOUND: (id: string) => new AlertNotFoundError(id),
  DUPLICATE: () => new DuplicateAlertError(),
}
