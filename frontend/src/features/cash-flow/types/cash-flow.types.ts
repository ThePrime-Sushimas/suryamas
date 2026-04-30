// ============================================================
// Cash Flow Frontend Types
// ============================================================

export type PeriodBalanceSource = 'MANUAL' | 'AUTO_PREV_PERIOD'

export interface AccountPeriodBalance {
  id: string
  bank_account_id: number
  company_id: string
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

export interface OpeningBalanceSuggestion {
  suggested_balance: number | null
  source: 'PREV_PERIOD' | 'NO_DATA'
  prev_period_id: string | null
  prev_period_start: string | null
  prev_period_end: string | null
}

// ============================================================
// Payment Method Groups
// ============================================================

export interface PaymentMethodGroupMapping {
  id: string
  group_id: string
  company_id: string
  payment_method_id: number
  created_at: string
}

export interface PaymentMethodGroup {
  id: string
  company_id: string
  name: string
  description: string | null
  color: string
  icon: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  mappings: PaymentMethodGroupMapping[]
}

export interface AvailablePaymentMethod {
  id: number
  name: string
  payment_type: string
  current_group_id: string | null
  current_group_name: string | null
}

export interface GroupsResponse {
  groups: PaymentMethodGroup[]
  available_payment_methods: AvailablePaymentMethod[]
}

export interface CreateGroupPayload {
  name: string
  description?: string | null
  color?: string
  icon?: string | null
  display_order?: number
  payment_method_ids?: number[]
}

export interface UpdateGroupPayload {
  name?: string
  description?: string | null
  color?: string
  icon?: string | null
  display_order?: number
  is_active?: boolean
  payment_method_ids?: number[]
}

// ============================================================
// Cash Flow Daily (Running Balance + Sales)
// ============================================================

export interface SalesBreakdownItem {
  payment_method_name: string
  payment_type: string
  total_amount: number
  transaction_count: number
  branch_breakdown?: {
    branch_id: string
    branch_name: string
    total_amount: number
    transaction_count: number
  }[]
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

export interface ExpenseGroup {
  purpose_id: string | null
  purpose_code: string | null
  purpose_name: string
  total_amount: number
  transaction_count: number
}

export interface CashFlowSummary {
  opening_balance: number
  total_income: number
  income_by_group: SalesGroup[]
  total_expense: number
  expense_by_category: ExpenseGroup[]
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
  purpose_id: string | null
  purpose_name: string | null
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

export interface Branch {
  branch_id: string
  branch_name: string
}

// ============================================================
// Form types
// ============================================================

export interface CreatePeriodFormData {
  bank_account_id: number
  period_start: string
  period_end: string
  opening_balance: number
  source: 'MANUAL' | 'AUTO_PREV_PERIOD'
  notes?: string
}

export interface UpdatePeriodFormData {
  period_start: string
  period_end: string
  opening_balance: number
  notes?: string
}

export interface GetRunningBalanceQuery {
  bank_account_id: number
  date_from: string
  date_to: string
  branch_id?: string
  page?: number
  limit?: number
}
