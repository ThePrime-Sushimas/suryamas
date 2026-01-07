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
}

export interface UpdateBankAccountDto {
  bank_id?: number
  account_name?: string
  account_number?: string
  is_primary?: boolean
  is_active?: boolean
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
