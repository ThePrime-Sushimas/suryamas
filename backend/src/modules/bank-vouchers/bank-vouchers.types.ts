// ============================================
// ENUMS
// ============================================

export type VoucherType = 'BM' | 'BK'

export type VoucherStatus = 'DRAFT' | 'CONFIRMED' | 'JOURNALED'

export type VoucherLineSource = 'RECONCILIATION' | 'SETTLEMENT_GROUP' | 'MULTI_MATCH' | 'MANUAL'

// ============================================
// QUERY PARAMS (request input)
// ============================================

export interface BankVoucherPreviewParams {
  company_id: string
  branch_id?: string
  period_month: number   // 1-12
  period_year: number    // e.g. 2026
  bank_account_id?: number
  voucher_type?: VoucherType
}

export interface BankVoucherSummaryParams {
  company_id: string
  branch_id?: string
  period_month: number
  period_year: number
}

// ============================================
// RAW DB ROW (from repository query)
// ============================================

export interface AggregatedVoucherRow {
  transaction_date: Date
  bank_account_id: number
  bank_account_name: string
  bank_account_number: string
  payment_method_id: number
  payment_method_name: string
  payment_type: string
  branch_id: string
  branch_name: string
  // Amounts
  gross_amount: string        // numeric comes as string from pg
  tax_amount: string
  nett_amount: string
  actual_fee_amount: string
  fee_discrepancy: string
  total_fee_amount: string
  // Counts
  transaction_count: string
}

// ============================================
// SERVICE LAYER (processed/computed)
// ============================================

export interface VoucherLine {
  line_number: number
  bank_account_id: number
  bank_account_name: string
  bank_account_number: string
  payment_method_id: number
  payment_method_name: string
  description: string               // e.g. "PENJUALAN OFFLINE", "BIAYA ADMIN ONLINE"
  is_fee_line: boolean
  gross_amount: number
  tax_amount: number
  nett_amount: number               // yang masuk bank (positif untuk penjualan, negatif untuk fee)
  actual_fee_amount: number         // total fee termasuk discrepancy
  transaction_count: number
}

export interface VoucherDay {
  transaction_date: string          // 'YYYY-MM-DD'
  voucher_number: string            // e.g. 'BM02260001'
  voucher_type: VoucherType
  branch_id: string
  branch_name: string
  lines: VoucherLine[]
  day_total: number                 // sum of all nett_amount untuk hari ini
}

export interface BankVoucherPreviewResult {
  period_month: number
  period_year: number
  period_label: string              // e.g. "Februari 2026"
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

export interface BankVoucherSummaryResult {
  period_label: string
  total_bank_masuk: number
  total_bank_keluar: number         // 0 sampai BK phase selesai
  saldo_berjalan: number
  by_bank: BankSummaryItem[]
  by_date: DailySummaryItem[]
}

export interface BankSummaryItem {
  bank_account_id: number
  bank_account_name: string
  total_masuk: number
  total_keluar: number
  saldo: number
}

export interface DailySummaryItem {
  transaction_date: string
  total_masuk: number
  total_keluar: number
  saldo_harian: number
  running_balance: number           // saldo berjalan kumulatif
}

// ============================================
// BANK ACCOUNTS DROPDOWN
// ============================================

export interface BankAccountOption {
  id: number
  account_name: string
  account_number: string
  bank_name: string
}
