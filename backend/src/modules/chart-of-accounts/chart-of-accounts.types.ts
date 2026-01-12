export interface ChartOfAccount {
  id: string
  company_id: string
  branch_id: string | null
  account_code: string
  account_name: string
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  account_subtype: string | null
  parent_account_id: string | null
  level: number
  account_path: string | null
  is_header: boolean
  is_postable: boolean
  normal_balance: 'DEBIT' | 'CREDIT'
  currency_code: string
  sort_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export interface CreateChartOfAccountDTO {
  company_id: string
  branch_id?: string | null
  account_code: string
  account_name: string
  account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  account_subtype?: string | null
  parent_account_id?: string | null
  is_header?: boolean
  is_postable?: boolean
  normal_balance: 'DEBIT' | 'CREDIT'
  currency_code?: string
  sort_order?: number | null
}

export interface UpdateChartOfAccountDTO {
  account_name?: string
  account_subtype?: string | null
  parent_account_id?: string | null
  is_header?: boolean
  is_postable?: boolean
  currency_code?: string
  sort_order?: number | null
  is_active?: boolean
}

export interface ChartOfAccountFilterParams {
  account_type?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  account_subtype?: string
  is_header?: boolean
  is_postable?: boolean
  is_active?: boolean
  parent_account_id?: string
  search?: string
}

export interface ChartOfAccountTreeNode extends ChartOfAccount {
  children?: ChartOfAccountTreeNode[]
}