export interface BalanceSheetRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY'
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

export interface BalanceSheetSummary {
  total_asset: number
  total_liability: number
  total_equity: number
  retained_earnings: number
  total_liability_equity: number
  is_balanced: boolean
  compare_total_asset: number
  compare_total_liability: number
  compare_total_equity: number
  compare_retained_earnings: number
  compare_total_liability_equity: number
}

export interface BalanceSheetFilter {
  as_of_date: string
  branch_ids: string[]
  compare_as_of_date?: string
}
