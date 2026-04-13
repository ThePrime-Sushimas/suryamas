// ============================================
// FILTER (query params ke API)
// ============================================

export interface BankVoucherFilter {
  period_month: number
  period_year: number
  branch_id?: string
  bank_account_id?: number
}

// ============================================
// API RESPONSE TYPES (mirror backend)
// ============================================

export type VoucherType = 'BM' | 'BK'
export type VoucherStatus = 'DRAFT' | 'CONFIRMED' | 'JOURNALED' | 'VOID'

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
  transaction_date: string
  voucher_number: string
  voucher_type: VoucherType
  bank_account_id: number
  bank_account_name: string
  branch_id: string
  branch_name: string
  lines: VoucherLine[]
  day_total: number
  is_confirmed?: boolean
  status?: VoucherStatus
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
  opening_balance: number
  total_masuk: number
  total_keluar: number
  saldo: number                  // opening + masuk - keluar
}

export interface DailySummaryItem {
  transaction_date: string
  total_masuk: number
  total_keluar: number
  saldo_harian: number
  running_balance: number        // starts from opening_balance
}

export interface BankVoucherSummaryResult {
  period_label: string
  opening_balance: number
  total_bank_masuk: number
  total_bank_keluar: number
  saldo_berjalan: number         // opening + masuk - keluar
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
// CONFIRM
// ============================================

export interface ConfirmResult {
  total_confirmed: number
  voucher_numbers: string[]
}

// ============================================
// LIST (confirmed vouchers)
// ============================================

export interface VoucherListItem {
  id: string
  voucher_number: string
  voucher_type: VoucherType
  status: VoucherStatus
  transaction_date: string
  bank_date: string
  bank_account_id: number
  bank_account_name: string
  branch_name: string | null
  is_manual: boolean
  total_gross: number
  total_tax: number
  total_fee: number
  total_nett: number
  description: string | null
  confirmed_at: string | null
  created_at: string
}

export interface VoucherListResult {
  period_label: string
  vouchers: VoucherListItem[]
  total: number
}

// ============================================
// DETAIL
// ============================================

export interface VoucherDetailLine {
  id: string
  line_number: number
  description: string
  payment_method_name: string | null
  is_fee_line: boolean
  gross_amount: number
  tax_amount: number
  actual_fee_amount: number
  nett_amount: number
  coa_code: string | null
  fee_coa_code: string | null
  source_type: string
  aggregate_id: string | null
  transaction_date: string | null
  is_manual: boolean
}

export interface VoucherDetail {
  id: string
  voucher_number: string
  voucher_type: VoucherType
  status: VoucherStatus
  transaction_date: string
  bank_date: string
  period_month: number
  period_year: number
  period_label: string
  branch_id: string | null
  branch_name: string | null
  bank_account_id: number
  bank_account_name: string
  bank_account_number: string | null
  company_name: string
  is_manual: boolean
  is_adjustment: boolean
  description: string | null
  notes: string | null
  total_gross: number
  total_tax: number
  total_fee: number
  total_nett: number
  confirmed_at: string | null
  confirmed_by_name: string | null
  created_by_name: string | null
  voided_at: string | null
  void_reason: string | null
  lines: VoucherDetailLine[]
}

// ============================================
// MANUAL CREATE
// ============================================

export interface ManualVoucherLineInput {
  description: string
  bank_account_id: number
  bank_account_name: string
  bank_account_number?: string
  payment_method_id?: number
  payment_method_name?: string
  is_fee_line: boolean
  gross_amount: number
  tax_amount: number
  actual_fee_amount: number
  nett_amount: number
  coa_account_id?: string
  fee_coa_account_id?: string
  transaction_date?: string
}

export interface ManualVoucherInput {
  voucher_type: VoucherType
  bank_date: string
  bank_account_id: number
  branch_id?: string
  description?: string
  notes?: string
  lines: ManualVoucherLineInput[]
}

// ============================================
// OPENING BALANCE
// ============================================

export interface OpeningBalanceData {
  id: string
  opening_balance: number
  total_masuk: number
  total_keluar: number
  closing_balance: number
  is_locked: boolean
  previous_month_closing: number
  period_label: string
}

// ============================================
// PAYMENT METHOD (for manual voucher dropdown)
// ============================================

export interface PaymentMethodOption {
  id: number
  code: string
  name: string
  payment_type: string
  bank_account_id: number | null
  bank_account_name: string | null
  bank_account_number: string | null
  bank_name: string | null
  coa_account_id: string | null
  coa_code: string | null
  fee_coa_account_id: string | null
  fee_coa_code: string | null
}

// ============================================
// UI STATE
// ============================================

export type ActiveTab = 'voucher' | 'summary' | 'list'
