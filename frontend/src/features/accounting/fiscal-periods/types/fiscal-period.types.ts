export interface FiscalPeriod {
  id: string
  company_id: string
  fiscal_year: number
  period: string
  period_start: string
  period_end: string
  is_open: boolean
  is_adjustment_allowed: boolean
  is_year_end: boolean
  opened_at?: string
  opened_by?: string
  closed_at?: string
  closed_by?: string
  close_reason?: string
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  deleted_at?: string
  deleted_by?: string
}

export interface FiscalPeriodWithDetails extends FiscalPeriod {
  opened_by_name?: string
  closed_by_name?: string
  created_by_name?: string
  updated_by_name?: string
}

export interface CreateFiscalPeriodDto {
  company_id?: string
  period: string
  period_start: string
  period_end: string
  is_adjustment_allowed?: boolean
  is_year_end?: boolean
}

export interface UpdateFiscalPeriodDto {
  is_adjustment_allowed?: boolean
}

export interface ClosePeriodDto {
  close_reason?: string
}

export interface FiscalPeriodFilter {
  company_id?: string
  fiscal_year?: number
  is_open?: boolean
  period?: string
  show_deleted?: boolean
  q?: string
}

export interface FiscalPeriodListResponse {
  data: FiscalPeriodWithDetails[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ============================================================================
// FISCAL CLOSING TYPES
// ============================================================================

export interface ClosePeriodWithEntriesDto {
  retained_earnings_account_id: string
  close_reason?: string
  branch_id?: string
  acknowledge_pending_warnings?: boolean
}

export interface ClosingAccountLine {
  account_id: string
  account_code: string
  account_name: string
  account_type: 'REVENUE' | 'EXPENSE'
  total_debit: number
  total_credit: number
  net_amount: number
  closing_debit: number
  closing_credit: number
}

export interface PendingModuleRecord {
  module: string
  severity: 'HARD_BLOCK' | 'WARNING'
  count: number
  total_amount: number
}

export interface PeriodClosingSummary {
  period: string
  period_start: string
  period_end: string
  total_revenue: number
  total_expense: number
  net_income: number
  is_profit: boolean
  accounts: ClosingAccountLine[]
  pending_journals_count: number
  posted_journals_count: number
  default_retained_earnings_account_id: string | null
  pending_module_records: {
    hard_block: PendingModuleRecord[]
    warning: PendingModuleRecord[]
  }
}

export interface ClosePeriodWithEntriesResult {
  period: FiscalPeriodWithDetails
  closing_journal_id: string
  closing_journal_number: string
  net_income: number
  is_profit: boolean
  lines_count: number
}


export interface ReopenPeriodDto {
  reopen_reason?: string
}

export interface ReopenPeriodResult {
  period: FiscalPeriodWithDetails
  reversed_journal_id: string
  reversed_journal_number: string
}

// ============================================================================
// CLOSING SNAPSHOT TYPES
// ============================================================================

export interface ClosingSnapshotSummary {
  id: string
  version: number
  is_latest: boolean
  net_income: number
  total_revenue: number
  total_expense: number
  closed_by: string
  closed_at: string
  closing_journal_id: string | null
}

export interface ClosingSnapshotHeader extends ClosingSnapshotSummary {
  fiscal_period_id: string
  company_id: string
  created_at: string
}

export interface ClosingSnapshotTrialBalanceLine {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  parent_account_code: string | null
  parent_account_name: string | null
  branch_id: string | null
  branch_name: string | null
  currency: string
  opening_debit: number
  opening_credit: number
  period_debit: number
  period_credit: number
  closing_debit: number
  closing_credit: number
  pos_debit: number
  pos_credit: number
  bank_debit: number
  bank_credit: number
  other_debit: number
  other_credit: number
}

export interface ClosingSnapshotReportLine {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  parent_account_id: string | null
  parent_account_code: string | null
  parent_account_name: string | null
  group_label: string | null
  branch_id: string | null
  branch_name: string | null
  currency: string
  debit_amount: number
  credit_amount: number
}

export interface ClosingSnapshotDetail {
  header: ClosingSnapshotHeader
  trial_balance: ClosingSnapshotTrialBalanceLine[]
  income_statement: ClosingSnapshotReportLine[]
  balance_sheet: ClosingSnapshotReportLine[]
}
