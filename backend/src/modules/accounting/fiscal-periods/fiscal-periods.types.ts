export interface FiscalPeriod {
  id: string
  company_id: string
  fiscal_year: number
  period: string // YYYY-MM (accounting period)
  period_start: string // DATE
  period_end: string // DATE
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

export interface CreateFiscalPeriodDto {
  period: string // YYYY-MM
  period_start: string
  period_end: string
  is_adjustment_allowed?: boolean
  is_year_end?: boolean
}

export interface UpdateFiscalPeriodDto {
  /**
   * Fields that can be modified while period is open.
   */
  period?: string
  period_start?: string
  period_end?: string
  is_adjustment_allowed?: boolean
  is_year_end?: boolean
}

export interface ClosePeriodDto {
  close_reason?: string
}

export interface FiscalPeriodFilter {
  fiscal_year?: number
  is_open?: boolean
  period?: string
  show_deleted?: boolean
  q?: string
}

export interface SortParams {
  field: 'period' | 'fiscal_year' | 'is_open' | 'created_at' | 'updated_at'
  order: 'asc' | 'desc'
}

// ============================================================================
// FISCAL CLOSING TYPES
// ============================================================================

export interface ClosePeriodWithEntriesDto {
  retained_earnings_account_id: string
  close_reason?: string
}

export interface ClosingAccountLine {
  account_id: string
  account_code: string
  account_name: string
  account_type: 'REVENUE' | 'EXPENSE'
  total_debit: number
  total_credit: number
  /** net amount in normal balance direction (Revenue=credit, Expense=debit) */
  net_amount: number
  /** closing entry: debit to zero-out this account */
  closing_debit: number
  /** closing entry: credit to zero-out this account */
  closing_credit: number
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
}

export interface ClosePeriodWithEntriesResult {
  period: FiscalPeriod
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
  period: FiscalPeriod
  reversed_journal_id: string
  reversed_journal_number: string
}
