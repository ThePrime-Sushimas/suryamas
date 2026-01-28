// payment-methods.types.ts

/**
 * Payment method types available in the system
 */
export type PaymentType =
  | 'BANK'
  | 'CARD'
  | 'CASH'
  | 'COMPLIMENT'
  | 'MEMBER_DEPOSIT'
  | 'OTHER_COST'

/**
 * Main payment method interface dengan FEE Configuration
 * 
 * NOTE: Marketing Fee = Expected Net - Actual Bank Deposit (calculated during reconciliation)
 *       Bukan percentage di payment method!
 */
export interface PaymentMethod {
  // === Basic Info ===
  id: number
  company_id: string
  code: string
  name: string
  description: string | null
  payment_type: PaymentType
  bank_account_id: number | null
  coa_account_id: string | null

  // === Status ===
  is_active: boolean
  is_default: boolean
  requires_bank_account: boolean
  sort_order: number

  // === 🔥 FEE CONFIGURATION (3 KOLOM SAJA) ===
  fee_percentage: number              // Persentase biaya (contoh: 20.0 = 20%)
  fee_fixed_amount: number           // Jumlah biaya tetap (contoh: 500 = Rp 500)
  fee_fixed_per_transaction: boolean // Apakah fixed fee per transaksi (true) atau per total (false)
  // NOTE: Marketing fee dihitung sebagai SELISIH expected vs actual, bukan di sini!

  // === Audit ===
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
 * DTO for creating a new payment method dengan FEE configuration
 * 
 * NOTE: Marketing fee dihitung saat reconciliation, bukan di sini!
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

  // === 🔥 FEE CONFIGURATION (3 KOLOM) ===
  fee_percentage?: number              // Default: 0
  fee_fixed_amount?: number           // Default: 0
  fee_fixed_per_transaction?: boolean // Default: false
}

/**
 * DTO for updating a payment method dengan FEE configuration
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

  // === 🔥 FEE CONFIGURATION (3 KOLOM) ===
  fee_percentage?: number
  fee_fixed_amount?: number
  fee_fixed_per_transaction?: boolean
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

