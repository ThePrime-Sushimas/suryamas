import { NotFoundError, BusinessRuleError, ConflictError } from '../../utils/errors.base'

// ============================================================
// VENDOR ERRORS
// ============================================================
export class VendorNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Vendor', id)
  }
}

export class VendorCodeDuplicateError extends ConflictError {
  constructor(code: string) {
    super(`Vendor code '${code}' sudah digunakan`)
  }
}

// ============================================================
// GENERAL INVOICE ERRORS
// ============================================================
export class GeneralInvoiceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('General invoice', id)
  }
}

export class GeneralInvoiceInvalidStatusError extends BusinessRuleError {
  constructor(current: string, expected: string | string[]) {
    const exp = Array.isArray(expected) ? expected.join(' / ') : expected
    super(`Status invoice tidak valid: saat ini '${current}', diharapkan '${exp}'`)
  }
}

export class GeneralInvoiceAlreadyPaidError extends BusinessRuleError {
  constructor(paymentNumber?: string, status?: string) {
    super(
      paymentNumber && status
        ? `Invoice sudah punya payment ${paymentNumber} (status: ${status}). Lanjutkan di halaman Payments.`
        : 'Invoice sudah lunas atau dalam proses pembayaran',
    )
  }
}

export class GeneralInvoiceLiabilityCoaMissingError extends BusinessRuleError {
  constructor() {
    super(
      "COA untuk hutang usaha umum belum dikonfigurasi. " +
      "Tambahkan accounting purpose dengan code 'GEN-AP-LIABILITY' dan map ke COA hutang.",
    )
  }
}

export class GeneralInvoiceBankCoaMissingError extends BusinessRuleError {
  constructor(bankAccountId: number) {
    super(
      `Bank account (ID: ${bankAccountId}) belum memiliki mapping COA. ` +
      "Konfigurasi bank account dengan COA yang sesuai.",
    )
  }
}

export class GeneralInvoiceLineEmptyError extends BusinessRuleError {
  constructor() {
    super('Invoice harus memiliki minimal 1 baris (line)')
  }
}

export class GeneralInvoiceTotalMismatchError extends BusinessRuleError {
  constructor(linesTotal: number, headerTotal: number) {
    super(
      `Total lines (${linesTotal.toFixed(2)}) tidak sama dengan total invoice (${headerTotal.toFixed(2)})`,
    )
  }
}

// ============================================================
// GENERAL PAYMENT ERRORS
// ============================================================
export class GeneralPaymentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('General payment', id)
  }
}

export class GeneralPaymentInvalidStatusError extends BusinessRuleError {
  constructor(current: string, expected: string | string[]) {
    const exp = Array.isArray(expected) ? expected.join(' / ') : expected
    super(`Status payment tidak valid: saat ini '${current}', diharapkan '${exp}'`)
  }
}

export class GeneralPaymentProofRequiredError extends BusinessRuleError {
  constructor() {
    super('Bukti pembayaran (proof) wajib diupload sebelum mark as paid')
  }
}

export class GeneralPaymentJournalMissingError extends BusinessRuleError {
  constructor() {
    super('Tidak ada journal yang terhubung ke payment ini')
  }
}

// ============================================================
// TEMPLATE ERRORS
// ============================================================
export class GeneralTemplateNotFoundError extends NotFoundError {
  constructor(id: string) {
    super('Template', id)
  }
}
