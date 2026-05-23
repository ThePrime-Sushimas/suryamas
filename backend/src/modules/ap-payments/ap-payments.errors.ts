import { AppError, BusinessRuleError, ErrorCategory, NotFoundError, ConflictError } from '../../utils/errors.base'

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

export class ApPaymentJournalCoaMissingError extends BusinessRuleError {
  constructor(detail: string) {
    super(`COA mapping untuk jurnal pembayaran tidak lengkap: ${detail}`)
  }
}

export class ApPaymentNoJournalError extends BusinessRuleError {
  constructor() {
    super('AP payment belum memiliki journal')
  }
}

export class ApPaymentJournalAlreadyPostedError extends BusinessRuleError {
  constructor() {
    super('Journal pembayaran sudah di-post')
  }
}

export class ApPaymentJournalNotReadyError extends BusinessRuleError {
  constructor(status: string) {
    super(`Journal tidak dapat di-post dari status ${status}`)
  }
}

export class ApPaymentEmptyLinesError extends BusinessRuleError {
  constructor() {
    super('AP payment must include at least one invoice line')
  }
}

// ── Bulk Payment Errors ───────────────────────────────────────

export class ApBulkInvoiceNotFoundError extends AppError {
  constructor(invoiceIds: string[]) {
    super(
      `Invoice(s) not found: ${invoiceIds.join(', ')}`,
      400,
      'AP_BULK_INVOICE_NOT_FOUND',
      { invoiceIds },
      undefined,
      ErrorCategory.VALIDATION,
    )
  }
}

export class ApBulkInvoiceNotEligibleError extends AppError {
  constructor(invoiceIds: string[]) {
    super(
      `Invoice(s) not eligible for payment (already PAID or RECONCILED): ${invoiceIds.join(', ')}`,
      400,
      'AP_BULK_INVOICE_NOT_ELIGIBLE',
      { invoiceIds },
      undefined,
      ErrorCategory.VALIDATION,
    )
  }
}

export class ApBulkOutstandingExceededError extends AppError {
  constructor(details: Array<{ invoiceId: string; outstanding: number; requested: number }>) {
    super(
      `Amount paid exceeds outstanding balance for one or more invoices`,
      400,
      'AP_BULK_OUTSTANDING_EXCEEDED',
      { details },
      undefined,
      ErrorCategory.VALIDATION,
    )
  }
}

export class ApBulkEmptyPaymentsError extends AppError {
  constructor() {
    super(
      'Bulk payment request must include at least one payment',
      400,
      'AP_BULK_EMPTY_PAYMENTS',
      undefined,
      undefined,
      ErrorCategory.VALIDATION,
    )
  }
}

export class ApBulkProofUploadFailedError extends AppError {
  public readonly fileIndex: number
  public readonly originalError: Error

  constructor(fileIndex: number, originalError: Error) {
    super(
      `Proof file upload failed for payment group ${fileIndex}`,
      500,
      'PROOF_UPLOAD_FAILED',
      { fileIndex, originalError: originalError.message },
      originalError,
      ErrorCategory.EXTERNAL_SERVICE,
    )
    this.fileIndex = fileIndex
    this.originalError = originalError
  }
}
