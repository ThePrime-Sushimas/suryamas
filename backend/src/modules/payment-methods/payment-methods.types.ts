// payment-methods.types.ts

/**
 * Payment method types available in the system
 */
export type PaymentType =
  | 'CASH' 
  | 'BANK_TRANSFER' 
  | 'GIRO' 
  | 'CREDIT_CARD' 
  | 'DEBIT_CARD' 
  | 'DIGITAL_WALLET' 
  | 'OTHER'

/**
 * Main payment method interface
 */
export interface PaymentMethod {
  id: number
  company_id: string
  code: string
  name: string
  description: string | null
  payment_type: PaymentType
  bank_account_id: number | null
  coa_account_id: string | null
  is_active: boolean
  is_default: boolean
  requires_bank_account: boolean
  sort_order: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
  deleted_by: string | null
}

/**
 * Payment method with related details
 */
export interface PaymentMethodWithDetails extends PaymentMethod {
  bank_code?: string
  bank_name?: string
  account_number?: string
  account_name?: string
  coa_code?: string
  coa_name?: string
  coa_type?: string
}

/**
 * DTO for creating a new payment method
 */
export interface CreatePaymentMethodDto {
  company_id: string
  code: string
  name: string
  description?: string | null
  payment_type: PaymentType
  bank_account_id?: number | null
  coa_account_id?: string | null
  is_default?: boolean
  requires_bank_account?: boolean
  sort_order?: number
}

/**
 * DTO for updating a payment method
 */
export interface UpdatePaymentMethodDto {
  code?: string
  name?: string
  description?: string | null
  payment_type?: PaymentType
  bank_account_id?: number | null
  coa_account_id?: string | null
  is_active?: boolean
  is_default?: boolean
  requires_bank_account?: boolean
  sort_order?: number
}

/**
 * Query parameters for listing payment methods
 */
export interface PaymentMethodFilterParams {
  company_id?: string
  payment_type?: PaymentType
  is_active?: boolean
  requires_bank_account?: boolean
  search?: string
}

/**
 * Payment method option for dropdowns
 */
export interface PaymentMethodOption {
  id: number
  code: string
  name: string
  payment_type: PaymentType
  bank_name?: string
}

