import type { VoucherType } from './bank-vouchers.types'

// ============================================
// VOUCHER NUMBER FORMAT
// BM02260001 = BM + MM + YY + sequence (4 digit zero-padded)
// ============================================

export const VOUCHER_CONFIG = {
  PREFIX: {
    BM: 'BM',
    BK: 'BK',
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
  ],
} as const

/**
 * Generate voucher number string
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
 * Get Indonesian month-year label
 * @example getPeriodLabel(2, 2026) => 'Februari 2026'
 */
export function getPeriodLabel(month: number, year: number): string {
  return `${VOUCHER_CONFIG.MONTH_NAMES_ID[month - 1]} ${year}`
}

/**
 * Get date range for a period (always 1st to last day of month)
 */
export function getPeriodDateRange(month: number, year: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  // Last day: day 0 of next month = last day of current month
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}
