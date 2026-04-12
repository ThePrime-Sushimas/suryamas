// ============================================
// FILTER (query params ke API)
// ============================================

export interface BankVoucherFilter {
  period_month: number   // 1-12
  period_year: number
  branch_id?: string
  bank_account_id?: number
}

// ============================================
// API RESPONSE TYPES (mirror backend)
// ============================================

export interface VoucherLine {
  line_number: number
  bank_account_id: number
  bank_account_name: string
  bank_account_number: string
  payment_method_id: number
  payment_method_name: string
  description: string
  is_fee_line: boolean
  gross_amount: number
  tax_amount: number
  nett_amount: number
  actual_fee_amount: number
  transaction_count: number
}

export interface VoucherDay {
  transaction_date: string       // 'YYYY-MM-DD'
  voucher_number: string         // 'BM02260001'
  voucher_type: 'BM' | 'BK'
  branch_id: string
  branch_name: string
  lines: VoucherLine[]
  day_total: number
}

export interface BankVoucherPreviewResult {
  period_month: number
  period_year: number
  period_label: string
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
  running_balance: number
}

export interface BankVoucherSummaryResult {
  period_label: string
  total_bank_masuk: number
  total_bank_keluar: number
  saldo_berjalan: number
  by_bank: BankSummaryItem[]
  by_date: DailySummaryItem[]
}

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
