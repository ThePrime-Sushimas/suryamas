// ============================================================
// BANK VOUCHERS TYPES
// ============================================================

// ============================================
// ENUMS
// ============================================

export type VoucherType = "BM" | "BK";

export type VoucherStatus = "DRAFT" | "CONFIRMED" | "JOURNALED" | "VOID";

export type VoucherLineSource =
  | "RECONCILIATION"
  | "SETTLEMENT_GROUP"
  | "MULTI_MATCH"
  | "MANUAL";

// ============================================
// QUERY PARAMS (request input)
// ============================================

export interface BankVoucherPreviewParams {
  company_id: string;
  branch_id?: string;
  period_month: number; // 1-12
  period_year: number; // e.g. 2026
  bank_account_id?: number;
  voucher_type?: VoucherType;
}

export interface BankVoucherSummaryParams {
  company_id: string;
  branch_id?: string;
  period_month: number;
  period_year: number;
}

// ============================================
// RAW DB ROW (from repository query)
// ============================================

export interface AggregatedVoucherRow {
  transaction_date: Date;
  bank_account_id: number;
  bank_account_name: string;
  bank_account_number: string;
  payment_method_id: number;
  payment_method_name: string;
  payment_type: string;
  branch_id: string;
  branch_name: string;
  // Amounts
  gross_amount: string; // numeric comes as string from pg
  tax_amount: string;
  actual_nett_amount: string; // = nett_amount - fee_discrepancy (nilai sesungguhnya yang masuk bank)
  actual_fee_amount: string;
  fee_discrepancy: string;
  total_fee_amount: string;
  // COA Mapping
  coa_account_id?: string;
  fee_coa_account_id?: string;
  // Counts
  transaction_count: string;
}

// ============================================
// SERVICE LAYER (processed/computed)
// ============================================

export interface VoucherLine {
  line_number: number;
  aggregate_id: string; // Link ke aggregated_transactions.id
  bank_account_id: number;
  bank_account_name: string;
  bank_account_number: string;
  payment_method_id: number;
  payment_method_name: string;
  description: string; // e.g. "CASH", "QRIS", "BIAYA ADMIN QRIS"
  is_fee_line: boolean;
  gross_amount: number;
  tax_amount: number;
  nett_amount: number; // yang masuk bank (positif untuk penjualan, negatif untuk fee)
  actual_fee_amount: number; // total fee termasuk discrepancy
  coa_account_id?: string;
  fee_coa_account_id?: string;
  transaction_count: number;
}

export interface VoucherDay {
  transaction_date: string; // 'YYYY-MM-DD'
  voucher_number: string; // e.g. 'BM02260001'
  voucher_type: VoucherType;
  bank_account_id: number; // Header bank account
  bank_account_name: string;
  branch_id: string;
  branch_name: string;
  lines: VoucherLine[];
  day_total: number; // sum of all nett_amount untuk hari ini
  is_confirmed?: boolean; // Phase 2
  status?: VoucherStatus; // DRAFT, CONFIRMED, etc.
}

export interface BankVoucherPreviewResult {
  period_month: number;
  period_year: number;
  period_label: string; // e.g. "Februari 2026"
  company_id: string;
  branch_id?: string;
  vouchers: VoucherDay[];
  summary: {
    total_gross: number;
    total_tax: number;
    total_fee: number;
    total_nett: number;
    total_vouchers: number;
    total_lines: number;
  };
}

export interface BankVoucherSummaryResult {
  period_label: string;
  total_bank_masuk: number;
  total_bank_keluar: number; // 0 sampai BK phase selesai
  saldo_berjalan: number;
  by_bank: BankSummaryItem[];
  by_date: DailySummaryItem[];
}

export interface BankSummaryItem {
  bank_account_id: number;
  bank_account_name: string;
  total_masuk: number;
  total_keluar: number;
  saldo: number;
}

export interface DailySummaryItem {
  transaction_date: string;
  total_masuk: number;
  total_keluar: number;
  saldo_harian: number;
  running_balance: number; // saldo berjalan kumulatif
}

// ============================================
// PRINT DATA (audit-ready)
// ============================================

export interface VoucherPrintLine {
  line_number: number;
  payment_method_name: string;
  description: string;
  is_fee_line: boolean;
  gross_amount: number;
  tax_amount: number;
  nett_amount: number;
  actual_fee_amount: number;
  coa_code: string | null;       // COA account code for audit
  fee_coa_code: string | null;   // Fee COA code for audit
  reference: string | null;      // settlement group / recon id
  source_type: string;
  transaction_date: string | null;
}

export interface VoucherPrintData {
  voucher_number: string;
  voucher_type: VoucherType;
  voucher_type_label: string;    // "Bank Masuk" / "Bank Keluar"
  status: string;
  transaction_date: string;
  bank_date: string;
  period_label: string;
  branch_name: string | null;
  bank_account_name: string;
  bank_account_number: string | null;
  company_name: string;
  company_npwp: string | null;
  description: string | null;
  notes: string | null;
  is_manual: boolean;
  // Totals
  total_gross: number;
  total_tax: number;
  total_fee: number;
  total_nett: number;
  // Lines
  lines: VoucherPrintLine[];
  // Audit
  created_by_name: string | null;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
  printed_at: string;
}

// ============================================
// BANK ACCOUNTS DROPDOWN
// ============================================

export interface BankAccountOption {
  id: number;
  account_name: string;
  account_number: string;
  bank_name: string;
}
