// ============================================================
// BANK VOUCHERS ERROR CLASSES
// ============================================================

/**
 * Base error class untuk bank vouchers
 */
export class BankVoucherError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message)
    this.name = 'BankVoucherError'
    Object.setPrototypeOf(this, BankVoucherError.prototype)
  }
}

/**
 * Bank voucher tidak ditemukan
 */
export class BankVoucherNotFoundError extends BankVoucherError {
  constructor(identifier: string) {
    super(
      `Bank voucher '${identifier}' not found`,
      'BANK_VOUCHER_NOT_FOUND',
      404
    )
    Object.setPrototypeOf(this, BankVoucherNotFoundError.prototype)
  }
}

/**
 * Tidak ada data reconciled untuk period tertentu
 */
export class BankVoucherNoPeriodDataError extends BankVoucherError {
  constructor(periodLabel: string) {
    super(
      `No reconciled transactions found for period ${periodLabel}`,
      'BANK_VOUCHER_NO_DATA',
      404
    )
    Object.setPrototypeOf(this, BankVoucherNoPeriodDataError.prototype)
  }
}

/**
 * Voucher sudah di-confirm dan tidak bisa diubah
 */
export class BankVoucherAlreadyConfirmedError extends BankVoucherError {
  constructor(voucherNumber: string) {
    super(
      `Voucher ${voucherNumber} is already confirmed and cannot be modified`,
      'BANK_VOUCHER_ALREADY_CONFIRMED',
      409
    )
    Object.setPrototypeOf(this, BankVoucherAlreadyConfirmedError.prototype)
  }
}

/**
 * Period tidak valid (month 1-12, year reasonable)
 */
export class BankVoucherInvalidPeriodError extends BankVoucherError {
  constructor(detail?: string) {
    super(
      detail ?? 'Invalid period: month must be 1-12 and year must be reasonable',
      'BANK_VOUCHER_INVALID_PERIOD',
      400
    )
    Object.setPrototypeOf(this, BankVoucherInvalidPeriodError.prototype)
  }
}

/**
 * Company context tidak ditemukan di request
 */
export class BankVoucherMissingCompanyError extends BankVoucherError {
  constructor() {
    super(
      'Company context is required',
      'BANK_VOUCHER_MISSING_COMPANY',
      400
    )
    Object.setPrototypeOf(this, BankVoucherMissingCompanyError.prototype)
  }
}

/**
 * Nomor voucher sudah digunakan
 */
export class BankVoucherDuplicateNumberError extends BankVoucherError {
  constructor(voucherNumber: string) {
    super(
      `Voucher number ${voucherNumber} already exists`,
      'BANK_VOUCHER_DUPLICATE_NUMBER',
      409
    )
    Object.setPrototypeOf(this, BankVoucherDuplicateNumberError.prototype)
  }
}

/**
 * Period sudah di-lock (jurnal sudah dibuat)
 */
export class BankVoucherPeriodLockedError extends BankVoucherError {
  constructor(periodLabel: string) {
    super(
      `Period ${periodLabel} is locked and cannot be modified`,
      'BANK_VOUCHER_PERIOD_LOCKED',
      409
    )
    Object.setPrototypeOf(this, BankVoucherPeriodLockedError.prototype)
  }
}

/**
 * Opening balance belum di-input untuk bulan pertama
 */
export class BankVoucherMissingOpeningBalanceError extends BankVoucherError {
  constructor(bankAccountName: string, periodLabel: string) {
    super(
      `Opening balance for ${bankAccountName} in ${periodLabel} is not set`,
      'BANK_VOUCHER_MISSING_OPENING_BALANCE',
      400
    )
    Object.setPrototypeOf(this, BankVoucherMissingOpeningBalanceError.prototype)
  }
}

/**
 * Bank account tidak ditemukan atau tidak aktif
 */
export class BankVoucherInvalidBankAccountError extends BankVoucherError {
  constructor(bankAccountId: number) {
    super(
      `Bank account ${bankAccountId} is not found or not active`,
      'BANK_VOUCHER_INVALID_BANK_ACCOUNT',
      400
    )
    Object.setPrototypeOf(this, BankVoucherInvalidBankAccountError.prototype)
  }
}

/**
 * Data aggregated tidak ditemukan
 */
export class BankVoucherAggregateNotFoundError extends BankVoucherError {
  constructor(aggregateId: string) {
    super(
      `Aggregated transaction ${aggregateId} not found`,
      'BANK_VOUCHER_AGGREGATE_NOT_FOUND',
      404
    )
    Object.setPrototypeOf(this, BankVoucherAggregateNotFoundError.prototype)
  }
}

/**
 * Settlement group invalid
 */
export class BankVoucherInvalidSettlementGroupError extends BankVoucherError {
  constructor(detail?: string) {
    super(
      detail ?? 'Invalid settlement group configuration',
      'BANK_VOUCHER_INVALID_SETTLEMENT_GROUP',
      400
    )
    Object.setPrototypeOf(this, BankVoucherInvalidSettlementGroupError.prototype)
  }
}

/**
 * Helper function untuk check apakah error adalah BankVoucherError
 */
export function isBankVoucherError(error: unknown): error is BankVoucherError {
  return error instanceof BankVoucherError
}
