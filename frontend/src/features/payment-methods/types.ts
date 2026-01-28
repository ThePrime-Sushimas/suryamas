// payment-methods.types.ts

export type PaymentType = 
  | 'BANK' 
  | 'CARD' 
  | 'CASH' 
  | 'COMPLIMENT' 
  | 'MEMBER_DEPOSIT' 
  | 'OTHER_COST'

export interface PaymentMethod {
  id: number
  company_id: string
  code: string
  name: string
  description: string | null
  payment_type: PaymentType
  bank_account_id: number | null
  bank_code?: string
  bank_name?: string
  account_number?: string
  account_name?: string
  coa_account_id: string | null
  coa_code?: string
  coa_name?: string
  coa_type?: string
  is_active: boolean
  is_default: boolean
  requires_bank_account: boolean
  sort_order: number
  // === 🔥 FEE CONFIGURATION ===
  fee_percentage: number              // Persentase biaya (contoh: 20.0 = 20%)
  fee_fixed_amount: number           // Jumlah biaya tetap (contoh: 500 = Rp 500)
  fee_fixed_per_transaction: boolean // Apakah fixed fee per transaksi (true) atau per total (false)
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export interface CreatePaymentMethodDto {
  code: string
  name: string
  description?: string | null
  payment_type: PaymentType
  bank_account_id?: number | null
  coa_account_id?: string | null
  is_default?: boolean
  requires_bank_account?: boolean
  sort_order?: number
  // === 🔥 FEE CONFIGURATION ===
  fee_percentage?: number              // Default: 0
  fee_fixed_amount?: number           // Default: 0
  fee_fixed_per_transaction?: boolean // Default: false
}

export type UpdatePaymentMethodDto = Partial<Omit<CreatePaymentMethodDto, 'code'>>

export interface PaginationParams {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface SortParams {
  field: string
  order: 'asc' | 'desc'
}

export interface FilterParams {
  payment_type?: PaymentType
  is_active?: boolean
  requires_bank_account?: boolean
  q?: string
}

export interface PaymentMethodOption {
  id: number
  code: string
  name: string
  payment_type: PaymentType
  bank_name?: string
}

// Fee configuration helper types
export interface FeeConfig {
  fee_percentage: number
  fee_fixed_amount: number
  fee_fixed_per_transaction: boolean
}

export interface FeeCalculationResult {
  grossAmount: number
  transactionCount: number
  percentageFee: number
  fixedFee: number
  totalFee: number
  expectedNet: number
}

