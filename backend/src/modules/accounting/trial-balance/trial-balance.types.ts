// ============================================================
// TYPES
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
  opening_debit: number
  opening_credit: number
  opening_balance: number
  period_debit: number
  period_credit: number
  period_net: number
  closing_debit: number
  closing_credit: number
  closing_balance: number
}

export interface TrialBalanceParams {
  companyId: string
  dateFrom: string
  dateTo: string
  branchId?: string
}
