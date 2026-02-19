export interface BankAccount {
  id: number
  bank_id: number
  bank_code: string
  bank_name: string
  owner_type: 'company' | 'supplier'
  owner_id: string // VARCHAR(50) - supports both UUID and integer as string
  account_name: string
  account_number: string
  currency: string
  is_primary: boolean
  is_active: boolean
  // COA Link (optional)
  coa_account_id: string | null
  coa_account?: {
    id: string
    account_code: string
    account_name: string
    account_type: string
  } | null
  created_at: string
}

export interface CreateBankAccountDto {
  bank_id: number
  owner_type: 'company' | 'supplier'
  owner_id: string // VARCHAR(50) - supports both UUID and integer as string
  account_name: string
  account_number: string
  is_primary?: boolean
  is_active?: boolean
  coa_account_id?: string | null
}

export interface UpdateBankAccountDto {
  bank_id?: number
  account_name?: string
  account_number?: string
  is_primary?: boolean
  is_active?: boolean
  coa_account_id?: string | null
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface ApiError {
  success: false
  error: string
  code?: string
}

// COA Option for dropdown selection
export interface CoaOption {
  id: string
  account_code: string
  account_name: string
  account_type: string
}
