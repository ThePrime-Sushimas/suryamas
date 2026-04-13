// ============================================================
// BANK VOUCHERS MODULE EXPORTS
// ============================================================

export { bankVouchersService, BankVouchersService } from './bank-vouchers.service'
export { bankVouchersController, BankVouchersController } from './bank-vouchers.controller'
export { bankVouchersRepository, BankVouchersRepository } from './bank-vouchers.repository'

export {
  VOUCHER_CONFIG,
  generateVoucherNumber,
  parseVoucherNumber,
  getPeriodLabel,
  getPeriodDateRange,
  validatePeriod,
  getCurrentPeriod,
  getPreviousPeriod,
  getNextPeriod,
  isDateInPeriod,
} from './bank-vouchers.config'

export type {
  VoucherType,
  VoucherStatus,
  VoucherLineSource,
  BankVoucherPreviewParams,
  BankVoucherSummaryParams,
  AggregatedVoucherRow,
  VoucherLine,
  VoucherDay,
  BankVoucherPreviewResult,
  BankVoucherSummaryResult,
  BankSummaryItem,
  DailySummaryItem,
  BankAccountOption,
} from './bank-vouchers.types'

export {
  BankVoucherError,
  BankVoucherNotFoundError,
  BankVoucherNoPeriodDataError,
  BankVoucherAlreadyConfirmedError,
  BankVoucherInvalidPeriodError,
  BankVoucherMissingCompanyError,
  BankVoucherDuplicateNumberError,
  BankVoucherPeriodLockedError,
  BankVoucherMissingOpeningBalanceError,
  BankVoucherInvalidBankAccountError,
  BankVoucherAggregateNotFoundError,
  BankVoucherInvalidSettlementGroupError,
  isBankVoucherError,
} from './bank-vouchers.errors'

export {
  bankVoucherPreviewSchema,
  bankVoucherSummarySchema,
  bankVoucherConfirmSchema,
  bankVoucherAdjustSchema,
  bankVoucherOpeningBalanceSchema,
  validatePeriodParams,
  validateUUID,
  safeValidatePeriod,
  periodMonthSchema,
  periodYearSchema,
  bankAccountIdSchema,
  uuidSchema,
  voucherTypeSchema,
} from './bank-vouchers.schema'

export type {
  BankVoucherPreviewQuery,
  BankVoucherSummaryQuery,
  BankVoucherConfirmRequest,
  BankVoucherAdjustRequest,
  BankVoucherOpeningBalanceRequest,
} from './bank-vouchers.schema'

// Default export untuk route registration
export { default } from './bank-vouchers.routes'
