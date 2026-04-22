export interface TrialBalanceRow {
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
}

export interface TrialBalanceFilter {
  company_id: string
  date_from: string
  date_to: string
  branch_ids: string[]
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
