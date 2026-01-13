export type Side = 'DEBIT' | 'CREDIT'
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

export interface AccountingPurposeAccount {
  id: string
  company_id: string
  purpose_id: string
  chart_account_id: string
  side: Side
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string | null
}

export interface AccountingPurposeAccountWithDetails extends AccountingPurposeAccount {
  purpose_name?: string
  purpose_code?: string
  account_code?: string
  account_name?: string
  account_type?: AccountType
  normal_balance?: Side
}

export interface CreateAccountingPurposeAccountDto {
  purpose_id: string
  account_id: string
  side: Side
  priority?: number
}

export interface UpdateAccountingPurposeAccountDto {
  side?: Side
  priority?: number
  is_active?: boolean
}

export interface BulkCreateAccountingPurposeAccountDto {
  purpose_id: string
  accounts: Array<{
    chart_account_id: string
    side: Side
    priority?: number
  }>
}

export interface BulkRemoveAccountingPurposeAccountDto {
  purpose_id: string
  account_ids: string[]
}

export interface AccountingPurposeAccountFilter {
  purpose_id?: string
  side?: Side
  account_type?: AccountType
  is_active?: boolean
}

export interface ChartOfAccount {
  id: string
  account_code: string
  account_name: string
  account_type: AccountType
  normal_balance: Side
  is_postable: boolean
  is_active: boolean
}

export interface AccountingPurpose {
  id: string
  purpose_code: string
  purpose_name: string
  is_active: boolean
}