export interface Bank {
  id: number
  bank_code: string
  bank_name: string
  is_active: boolean
  created_at: string
}

export interface CreateBankDto {
  bank_code: string
  bank_name: string
  is_active?: boolean
}

export interface UpdateBankDto {
  bank_name?: string
  is_active?: boolean
}

export interface BankListQuery {
  page?: number
  limit?: number
  search?: string
  is_active?: boolean
}

export interface BankOption {
  id: number
  bank_code: string
  bank_name: string
}
