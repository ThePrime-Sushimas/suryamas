import { BusinessRuleError, NotFoundError } from '../../utils/errors.base'

export class PurchaseInvoiceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Purchase invoice not found: ${id}`)
  }
}

export class PurchaseInvoiceInvalidStatusError extends BusinessRuleError {
  constructor(actual: string, expected: string) {
    super(`Invalid purchase invoice status: expected ${expected} but got ${actual}`)
  }
}

export class PurchaseInvoiceCannotEditPostedError extends BusinessRuleError {
  constructor() {
    super('Purchase invoice cannot be edited after posted')
  }
}

export class PurchaseInvoiceGrNotEligibleError extends BusinessRuleError {
  constructor(detail?: string) {
    super(detail ?? 'Goods receipt not eligible for purchase invoice')
  }
}

export class PurchaseInvoiceJournalAlreadyExistsError extends BusinessRuleError {
  constructor() {
    super('Purchase invoice already posted (journal exists)')
  }
}

export class PurchaseInvoiceGpNotConfirmedError extends BusinessRuleError {
  constructor(gpNumber: string) {
    super(`Cannot post: Goods Processing ${gpNumber} is not CONFIRMED`)
  }
}
