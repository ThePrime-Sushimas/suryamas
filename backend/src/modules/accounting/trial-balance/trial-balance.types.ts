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

export interface TrialBalanceParams {
  companyId: string
  dateFrom: string
  dateTo: string
  branchIds?: string[]
}
