export type CalculationType = 'from_invoice' | 'from_delivery' | 'fixed_dates' | 'weekly' | 'monthly'

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
  is_active: boolean
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
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
  is_active?: boolean
  description?: string
}

export type UpdatePaymentTermDto = Omit<Partial<CreatePaymentTermDto>, 'term_code'>

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
  calculation_type?: CalculationType
  is_active?: boolean
  q?: string
}

export interface MinimalPaymentTerm {
  id: number
  term_name: string
}
