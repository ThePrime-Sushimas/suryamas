export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
export type NormalBalance = 'DEBIT' | 'CREDIT'

export interface ChartOfAccount {
  id: string
  company_id: string
  branch_id: string | null
  account_code: string
  account_name: string
  account_type: AccountType
  account_subtype: string | null
  parent_account_id: string | null
  level: number
  account_path: string | null
  is_header: boolean
  is_postable: boolean
  normal_balance: NormalBalance
  currency_code: string
  sort_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChartOfAccountTreeNode extends ChartOfAccount {
  children?: ChartOfAccountTreeNode[]
}

export type CreateChartOfAccountDto = Pick<ChartOfAccount, 'company_id' | 'account_code' | 'account_name' | 'account_type' | 'normal_balance'> &
  Partial<Pick<ChartOfAccount, 'branch_id' | 'account_subtype' | 'parent_account_id' | 'is_header' | 'is_postable' | 'currency_code' | 'sort_order'>>

export type UpdateChartOfAccountDto = Partial<
  Pick<ChartOfAccount, 'account_name' | 'account_subtype' | 'parent_account_id' | 'is_header' | 'is_postable' | 'currency_code' | 'sort_order' | 'is_active'>
>

export interface ChartOfAccountFilter {
  account_type?: AccountType
  account_subtype?: string
  is_header?: boolean
  is_postable?: boolean
  is_active?: boolean
  parent_account_id?: string
}