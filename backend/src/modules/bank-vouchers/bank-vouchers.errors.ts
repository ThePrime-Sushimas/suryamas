export class BankVoucherError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message)
    this.name = 'BankVoucherError'
  }
}

export class BankVoucherNotFoundError extends BankVoucherError {
  constructor(identifier: string) {
    super(`Bank voucher '${identifier}' not found`, 'BANK_VOUCHER_NOT_FOUND', 404)
  }
}

export class BankVoucherNoPeriodDataError extends BankVoucherError {
  constructor(periodLabel: string) {
    super(
      `No reconciled transactions found for period ${periodLabel}`,
      'BANK_VOUCHER_NO_DATA',
      404
    )
  }
}

export class BankVoucherAlreadyConfirmedError extends BankVoucherError {
  constructor(voucherNumber: string) {
    super(
      `Voucher ${voucherNumber} is already confirmed and cannot be modified`,
      'BANK_VOUCHER_ALREADY_CONFIRMED',
      409
    )
  }
}

export class BankVoucherInvalidPeriodError extends BankVoucherError {
  constructor(detail?: string) {
    super(
      detail ?? 'Invalid period: month must be 1-12 and year must be reasonable',
      'BANK_VOUCHER_INVALID_PERIOD',
      400
    )
  }
}

export class BankVoucherMissingCompanyError extends BankVoucherError {
  constructor() {
    super('Company context is required', 'BANK_VOUCHER_MISSING_COMPANY', 400)
  }
}
