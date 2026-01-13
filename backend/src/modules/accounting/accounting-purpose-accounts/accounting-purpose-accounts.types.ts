// accounting-purpose-accounts.types.ts

export type Side = 'DEBIT' | 'CREDIT'

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
  deleted_at: string | null
  deleted_by: string | null
}

export interface CreateAccountingPurposeAccountDTO {
  purpose_id: string
  chart_account_id: string
  side: Side
  priority?: number
}

export interface UpdateAccountingPurposeAccountDTO {
  side?: Side
  priority?: number
  is_active?: boolean
}

export interface AccountingPurposeAccountWithDetails extends AccountingPurposeAccount {
  purpose_name?: string
  purpose_code?: string
  account_code?: string
  account_name?: string
  account_type?: string
  normal_balance?: Side
}

export interface BulkCreateAccountingPurposeAccountDTO {
  purpose_id: string
  accounts: Array<{
    chart_account_id: string
    side: Side
    priority?: number
  }>
}

export interface BulkRemoveAccountingPurposeAccountDTO {
  purpose_id: string
  account_ids: string[]
}

export interface AccountingPurposeAccountFilterParams {
  purpose_id?: string
  side?: Side
  account_type?: string
  is_active?: boolean
  search?: string
}
