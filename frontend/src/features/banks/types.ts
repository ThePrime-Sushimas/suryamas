export interface Bank {
  id: number
  bank_code: string
  bank_name: string
  is_active: boolean
  created_at: string
}

export interface BankOption {
  id: number
  bank_code: string
  bank_name: string
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

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  pagination?: PaginationMeta
}

export interface ApiError {
  success: false
  error: string
  code?: string
}
