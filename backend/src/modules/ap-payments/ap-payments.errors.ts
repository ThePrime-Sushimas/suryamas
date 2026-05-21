import { BusinessRuleError, NotFoundError, ConflictError } from '../../utils/errors.base'

export class ApPaymentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`AP payment not found: ${id}`)
  }
}

export class ApPaymentInvalidStatusError extends BusinessRuleError {
  constructor(actual: string, expected: string | string[]) {
    const expectedStr = Array.isArray(expected) ? expected.join(' or ') : expected
    super(`Invalid AP payment status: expected ${expectedStr} but got ${actual}`)
  }
}

export class ApPaymentInvoiceNotEligibleError extends BusinessRuleError {
  constructor(invoiceNumber: string) {
    super(
      `Purchase invoice ${invoiceNumber} must be APPROVED or POSTED before it can be added to a payment`,
    )
  }
}

export class ApPaymentInvoiceNotPostedForPaidError extends BusinessRuleError {
  constructor(invoiceNumber: string) {
    super(
      `Purchase invoice ${invoiceNumber} must be POSTED (jurnal hutang sudah terbentuk) before payment can be marked as PAID`,
    )
  }
}

export class ApPaymentOutstandingExceededError extends BusinessRuleError {
  constructor(invoiceNumber: string, outstanding: number, requested: number) {
    super(
      `Amount paid (${requested}) exceeds outstanding balance (${outstanding}) for invoice ${invoiceNumber}`
    )
  }
}

export class ApPaymentLinesTotalMismatchError extends BusinessRuleError {
  constructor(linesTotal: number, headerTotal: number) {
    super(
      `Sum of invoice lines (${linesTotal}) does not match payment total_amount (${headerTotal})`
    )
  }
}

export class ApPaymentDuplicateInvoiceError extends ConflictError {
  constructor(invoiceNumber: string, paymentNumber?: string) {
    const suffix = paymentNumber ? ` (payment ${paymentNumber})` : ''
    super(`Invoice ${invoiceNumber} is already included in another active payment${suffix}`)
  }
}

export class ApPaymentNoDefaultBankAccountError extends BusinessRuleError {
  constructor(companyId: string) {
    super(
      `No active company bank account found for company ${companyId}; cannot auto-create AP payment draft`,
    )
  }
}

export class ApPaymentProofRequiredError extends BusinessRuleError {
  constructor() {
    super('Proof of payment must be uploaded before marking as PAID')
  }
}

export class ApPaymentEmptyLinesError extends BusinessRuleError {
  constructor() {
    super('AP payment must include at least one invoice line')
  }
}
