import type { VoucherType } from './bank-vouchers.types'

// ============================================================
// VOUCHER NUMBER FORMAT & CONFIGURATION
// ============================================================

export const VOUCHER_CONFIG = {
  PREFIX: {
    BM: 'BM',  // Bank Masuk (inflow)
    BK: 'BK',  // Bank Keluar (outflow)
  } as Record<VoucherType, string>,

  NUMBER_FORMAT: {
    SEQUENCE_LENGTH: 4,       // zero-padded: 0001, 0002, ...
    // Full format: {PREFIX}{MM}{YY}{SEQUENCE}
    // Example: BM02260001
  },

  // Months in Indonesian for period_label
  MONTH_NAMES_ID: [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ] as const,

  // Validation
  MIN_YEAR: 2020,
  MAX_YEAR: 2099,
} as const

/**
 * Generate voucher number string
 * Format: {PREFIX}{MM}{YY}{SEQ}
 * @example generateVoucherNumber('BM', 2, 2026, 1) => 'BM02260001'
 */
export function generateVoucherNumber(
  type: VoucherType,
  month: number,
  year: number,
  sequence: number
): string {
  const prefix = VOUCHER_CONFIG.PREFIX[type]
  const mm = String(month).padStart(2, '0')
  const yy = String(year).slice(-2)
  const seq = String(sequence).padStart(VOUCHER_CONFIG.NUMBER_FORMAT.SEQUENCE_LENGTH, '0')
  return `${prefix}${mm}${yy}${seq}`
}

/**
 * Parse voucher number menjadi komponen
 * @example parseVoucherNumber('BM02260001') => { type: 'BM', month: 2, year: 2026, sequence: 1 }
 */
export function parseVoucherNumber(voucherNumber: string): {
  type: VoucherType
  month: number
  year: number
  sequence: number
} {
  const pattern = /^(BM|BK)(\d{2})(\d{2})(\d{4})$/
  const match = voucherNumber.match(pattern)

  if (!match) {
    throw new Error(`Invalid voucher number format: ${voucherNumber}`)
  }

  const [, type, month, year, sequence] = match
  return {
    type: type as VoucherType,
    month: parseInt(month, 10),
    year: 2000 + parseInt(year, 10),
    sequence: parseInt(sequence, 10),
  }
}

/**
 * Get Indonesian month-year label
 * @example getPeriodLabel(2, 2026) => 'Februari 2026'
 */
export function getPeriodLabel(month: number, year: number): string {
  if (month < 1 || month > 12) {
    throw new Error('Month must be between 1 and 12')
  }
  const monthName = VOUCHER_CONFIG.MONTH_NAMES_ID[month - 1]
  return `${monthName} ${year}`
}

/**
 * Get date range for a period (always 1st to last day of month)
 * Returns ISO date strings (YYYY-MM-DD)
 */
export function getPeriodDateRange(month: number, year: number): {
  start: string
  end: string
} {
  if (month < 1 || month > 12) {
    throw new Error('Month must be between 1 and 12')
  }

  const start = `${year}-${String(month).padStart(2, '0')}-01`

  // Last day: day 0 of next month = last day of current month
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  return { start, end }
}

/**
 * Validate period parameters
 * @throws Error jika month atau year invalid
 */
export function validatePeriod(month: number, year: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Period month must be an integer between 1 and 12')
  }

  if (!Number.isInteger(year) || year < VOUCHER_CONFIG.MIN_YEAR || year > VOUCHER_CONFIG.MAX_YEAR) {
    throw new Error(
      `Period year must be an integer between ${VOUCHER_CONFIG.MIN_YEAR} and ${VOUCHER_CONFIG.MAX_YEAR}`
    )
  }
}

/**
 * Get current period (month + year sekarang)
 */
export function getCurrentPeriod(): { month: number; year: number } {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
}

/**
 * Get previous month period
 */
export function getPreviousPeriod(month: number, year: number): { month: number; year: number } {
  if (month === 1) {
    return { month: 12, year: year - 1 }
  }
  return { month: month - 1, year }
}

/**
 * Get next month period
 */
export function getNextPeriod(month: number, year: number): { month: number; year: number } {
  if (month === 12) {
    return { month: 1, year: year + 1 }
  }
  return { month: month + 1, year }
}

/**
 * Check apakah suatu tanggal termasuk dalam period
 */
export function isDateInPeriod(date: Date | string, month: number, year: number): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.getMonth() + 1 === month && d.getFullYear() === year
}
