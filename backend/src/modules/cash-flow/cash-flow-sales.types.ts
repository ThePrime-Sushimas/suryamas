// ============================================================
// Period Balance Types
// ============================================================

export type PeriodBalanceSource = 'MANUAL' | 'AUTO_PREV_PERIOD'

export interface AccountPeriodBalance {
  id: string
  company_id: string
  bank_account_id: number
  period_start: string
  period_end: string
  opening_balance: number
  source: PeriodBalanceSource
  previous_period_id: string | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface CreatePeriodBalanceDto {
  company_id: string
  bank_account_id: number
  period_start: string
  period_end: string
  opening_balance: number
  source?: PeriodBalanceSource
  previous_period_id?: string | null
  notes?: string | null
  created_by?: string
}

export interface UpdatePeriodBalanceDto {
  period_start?: string
  period_end?: string
  opening_balance?: number
  source?: PeriodBalanceSource
  notes?: string | null
  updated_by?: string
}

export interface OpeningBalanceSuggestion {
  suggested_balance: number | null
  source: 'PREV_PERIOD' | 'NO_DATA'
  prev_period_id: string | null
  prev_period_start: string | null
  prev_period_end: string | null
}

// ============================================================
// Payment Method Groups Types
// ============================================================

export interface PaymentMethodGroup {
  id: string
  company_id: string
  name: string
  description: string | null
  color: string
  icon: string | null
  display_order: number
  is_active: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  mappings?: PaymentMethodGroupMapping[]
}

export interface PaymentMethodGroupMapping {
  id: string
  group_id: string
  company_id: string
  payment_method_id: number
  created_by: string | null
  created_at: string
}

export interface CreateGroupDto {
  company_id: string
  name: string
  description?: string | null
  color?: string
  icon?: string | null
  display_order?: number
  payment_method_ids?: number[]
  created_by?: string
}

export interface UpdateGroupDto {
  name?: string
  description?: string | null
  color?: string
  icon?: string | null
  display_order?: number
  is_active?: boolean
  payment_method_ids?: number[]
  updated_by?: string
}

// ============================================================
// Cash Flow Sales Types (per bank account)
// ============================================================

export interface SalesBreakdownItem {
  payment_method_name: string
  payment_type: string
  total_amount: number
  transaction_count: number
  branch_breakdown?: BranchBreakdownItem[]
}

export interface BranchBreakdownItem {
  branch_id: string
  branch_name: string
  total_amount: number
  transaction_count: number
}

export interface SalesGroup {
  group_id: string | null
  group_name: string
  group_color: string
  display_order: number
  items: SalesBreakdownItem[]
  subtotal: number
  transaction_count: number
}

export interface RunningBalanceRow {
  id: string
  bank_account_id: number
  company_id: string
  transaction_date: string
  row_number: number
  description: string
  credit_amount: number
  debit_amount: number
  bank_balance: number | null
  running_balance: number
  is_pending: boolean
  is_reconciled: boolean
  payment_method_name: string | null
  payment_type: string | null
  group_name: string | null
  group_color: string | null
  branch_name: string | null
  expense_category: string | null
}

export interface CashFlowSummary {
  opening_balance: number
  total_income: number
  income_by_group: SalesGroup[]
  total_expense: number
  closing_balance: number
  net_change: number
  pending_count: number
  pending_income_estimate: number
  pending_expense_estimate: number
  unreconciled_count: number
  unreconciled_credit_count: number
  unreconciled_credit_amount: number
  unreconciled_debit_count: number
  unreconciled_debit_amount: number
}

export interface CashFlowDailyResult {
  period: AccountPeriodBalance | null
  bank_account: {
    id: number
    bank_name: string
    account_number: string
    account_name: string
  }
  summary: CashFlowSummary
  rows: RunningBalanceRow[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

export interface GetCashFlowParams {
  bank_account_id: number
  company_id: string
  date_from: string
  date_to: string
  branch_id?: string
  page?: number
  limit?: number
}

export interface AvailablePaymentMethod {
  id: number
  name: string
  payment_type: string
  current_group_id: string | null
  current_group_name: string | null
}
