/**
 * Bank Vouchers Frontend Types
 * Mirrors backend types untuk type safety
 */

// ============================================
// FILTER (query params ke API)
// ============================================

export interface BankVoucherFilter {
  period_month: number   // 1-12
  period_year: number    // e.g. 2026
  branch_id?: string     // UUID (optional)
  bank_account_id?: number // (optional)
}

// ============================================
// API RESPONSE TYPES (mirror backend)
// ============================================

/**
 * Single line dalam voucher
 */
export interface VoucherLine {
  line_number: number
  bank_account_id: number
  bank_account_name: string
  bank_account_number: string
  payment_method_id: number
  payment_method_name: string
  description: string                    // 'CASH', 'QRIS', 'BIAYA ADMIN QRIS'
  is_fee_line: boolean
  gross_amount: number
  tax_amount: number
  nett_amount: number                    // yang masuk bank
  actual_fee_amount: number
  transaction_count: number              // jumlah transaksi POS
}

/**
 * Voucher per hari (1 voucher = 1 tanggal)
 */
export interface VoucherDay {
  transaction_date: string               // 'YYYY-MM-DD'
  voucher_number: string                 // 'BM02260001'
  voucher_type: 'BM' | 'BK'              // Bank Masuk | Bank Keluar
  branch_id: string
  branch_name: string
  lines: VoucherLine[]
  day_total: number                      // total nett untuk hari ini
  is_confirmed: boolean
}

/**
 * Preview response dari API
 */
export interface BankVoucherPreviewResult {
  period_month: number
  period_year: number
  period_label: string                   // 'Februari 2026'
  company_id: string
  branch_id?: string
  vouchers: VoucherDay[]
  summary: {
    total_gross: number
    total_tax: number
    total_fee: number
    total_nett: number
    total_vouchers: number
    total_lines: number
  }
}

/**
 * Summary per bank
 */
export interface BankSummaryItem {
  bank_account_id: number
  bank_account_name: string
  total_masuk: number
  total_keluar: number
  saldo: number
}

/**
 * Summary per hari dengan running balance
 */
export interface DailySummaryItem {
  transaction_date: string
  total_masuk: number
  total_keluar: number
  saldo_harian: number
  running_balance: number                // kumulatif saldo
}

/**
 * Summary response dari API
 */
export interface BankVoucherSummaryResult {
  period_label: string
  total_bank_masuk: number
  total_bank_keluar: number              // 0 di Phase 1
  saldo_berjalan: number
  by_bank: BankSummaryItem[]
  by_date: DailySummaryItem[]
}

/**
 * Bank account option untuk dropdown
 */
export interface BankAccountOption {
  id: number
  account_name: string
  account_number: string
  bank_name: string
}

// ============================================
// UI STATE
// ============================================

export type ActiveTab = 'voucher' | 'summary'