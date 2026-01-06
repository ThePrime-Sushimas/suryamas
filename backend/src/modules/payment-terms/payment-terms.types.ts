// backend/src/modules/payment-terms/payment-terms.types.ts

export type CalculationType = 'from_invoice' | 'from_delivery' | 'fixed_date' | 'weekly' | 'monthly'

export interface PaymentTerm {
  id: number
  term_code: string
  term_name: string
  calculation_type: CalculationType
  days: number
  payment_dates: number[] | null
  payment_day_of_week: number | null
  early_payment_discount: number
  early_payment_days: number
  late_payment_penalty: number
  grace_period_days: number
  minimum_order_amount: number
  maximum_order_amount: number | null
  allowed_payment_methods: string[] | null
  requires_guarantee: boolean
  guarantee_type: string | null
  seasonal_terms: any | null
  volume_discount_tiers: any | null
  is_active: boolean
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by: string | null
  deleted_by: string | null
}

export interface CreatePaymentTermDto {
  term_code: string
  term_name: string
  calculation_type?: CalculationType
  days?: number
  payment_dates?: number[]
  payment_day_of_week?: number
  early_payment_discount?: number
  early_payment_days?: number
  late_payment_penalty?: number
  grace_period_days?: number
  minimum_order_amount?: number
  maximum_order_amount?: number
  allowed_payment_methods?: string[]
  requires_guarantee?: boolean
  guarantee_type?: string
  seasonal_terms?: any
  volume_discount_tiers?: any
  is_active?: boolean
  description?: string
}

export interface UpdatePaymentTermDto {
  term_name?: string
  calculation_type?: CalculationType
  days?: number
  payment_dates?: number[]
  payment_day_of_week?: number
  early_payment_discount?: number
  early_payment_days?: number
  late_payment_penalty?: number
  grace_period_days?: number
  minimum_order_amount?: number
  maximum_order_amount?: number
  allowed_payment_methods?: string[]
  requires_guarantee?: boolean
  guarantee_type?: string
  seasonal_terms?: any
  volume_discount_tiers?: any
  is_active?: boolean
  description?: string
}
