export type AppliedToType =
  | 'SALES'
  | 'PURCHASE'
  | 'CASH'
  | 'BANK'
  | 'INVENTORY'

export interface AccountingPurpose {
  id: string
  company_id: string
  branch_id?: string

  purpose_code: string
  purpose_name: string
  applied_to: AppliedToType

  description?: string
  is_active: boolean
  is_system: boolean

  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface CreateAccountingPurposeDto {
  company_id: string
  branch_id?: string
  purpose_code: string
  purpose_name: string
  applied_to: AppliedToType
  description?: string
  is_active?: boolean
}

export interface UpdateAccountingPurposeDto {
  purpose_name?: string
  applied_to?: AppliedToType
  description?: string
  is_active?: boolean
}

export interface PaginationParams {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface SortParams {
  field: 'purpose_code' | 'purpose_name' | 'applied_to' | 'is_active' | 'created_at' | 'updated_at'
  order: 'asc' | 'desc'
}

export interface FilterParams {
  applied_to?: AppliedToType
  is_active?: boolean
  q?: string
}