export interface IncomeStatementRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: 'REVENUE' | 'EXPENSE'
  parent_account_id: string | null
  parent_account_code: string | null
  parent_account_name: string | null
  group_label: string
  branch_id: string | null
  branch_name: string | null
  currency: string
  debit_amount: number
  credit_amount: number
  compare_debit_amount: number
  compare_credit_amount: number
}

export interface IncomeStatementSummary {
  total_revenue: number
  total_expense: number
  net_income: number
  compare_total_revenue: number
  compare_total_expense: number
  compare_net_income: number
}

export interface IncomeStatementFilter {
  date_from: string
  date_to: string
  branch_ids: string[]
  compare_date_from?: string
  compare_date_to?: string
}
