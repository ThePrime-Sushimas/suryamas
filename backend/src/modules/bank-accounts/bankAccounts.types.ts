export type OwnerType = 'company' | 'supplier'

export interface BankAccount {
  id: number
  bank_id: number
  account_name: string
  account_number: string
  owner_type: OwnerType
  owner_id: string // VARCHAR(50) - supports both UUID and integer as string
  currency: string
  is_primary: boolean
  is_active: boolean
  verified_by: string | null // UUID
  // COA Link (optional)
  coa_account_id: string | null

  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null // UUID
}


export interface BankAccountWithBank extends BankAccount {
  bank_code?: string
  bank_name?: string
  bank?: {
    id: number
    bank_code: string
    bank_name: string
  }
  // COA details
  coa_account?: {
    id: string
    account_code: string
    account_name: string
    account_type: string
  } | null
}


export interface CreateBankAccountDto {
  bank_id: number
  account_name: string
  account_number: string
  owner_type: OwnerType
  owner_id: string // VARCHAR(50) - supports both UUID and integer as string
  is_primary?: boolean
  is_active?: boolean
  coa_account_id?: string | null // Optional COA link
}

export interface UpdateBankAccountDto {
  account_name?: string
  account_number?: string
  is_primary?: boolean
  is_active?: boolean
  coa_account_id?: string | null // Optional COA link
}

export interface BankAccountListQuery {
  page?: number
  limit?: number
  owner_type?: OwnerType
  owner_id?: string // VARCHAR(50) - supports both UUID and integer as string
  bank_id?: number
  is_active?: boolean
}

export interface BankAccountOption {
  id: number
  account_name: string
  account_number: string
  bank_name: string
}
