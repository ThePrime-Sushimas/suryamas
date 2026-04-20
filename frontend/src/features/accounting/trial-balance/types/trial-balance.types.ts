// ============================================================
// Trial Balance Types
// ============================================================

export interface TrialBalanceRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  account_subtype: string | null
  normal_balance: string
  parent_account_id: string | null
  account_level: number
  // Opening balance (before date_from)
  opening_debit: number
  opening_credit: number
  opening_balance: number
  // Period movements
  period_debit: number
  period_credit: number
  period_net: number
  // Closing balance
  closing_debit: number
  closing_credit: number
  closing_balance: number
}

export interface TrialBalanceSummary {
  total_opening_debit: number
  total_opening_credit: number
  total_period_debit: number
  total_period_credit: number
  total_closing_debit: number
  total_closing_credit: number
  is_balanced: boolean
}

export interface TrialBalanceFilter {
  company_id: string
  date_from: string
  date_to: string
  branch_id?: string
}

export interface TrialBalanceGrouped {
  account_type: string
  rows: TrialBalanceRow[]
  subtotal_opening_debit: number
  subtotal_opening_credit: number
  subtotal_period_debit: number
  subtotal_period_credit: number
  subtotal_closing_debit: number
  subtotal_closing_credit: number
}
