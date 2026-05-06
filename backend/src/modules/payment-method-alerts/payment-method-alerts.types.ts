export interface PaymentMethodAlert {
  id: string
  company_id: string
  payment_method_id: number
  threshold_amount: number
  telegram_chat_id: string
  is_active: boolean
  last_triggered_date: string | null
  last_triggered_amount: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Joined
  payment_method_name?: string
}

export interface CreateAlertDto {
  payment_method_id: number
  threshold_amount: number
  telegram_chat_id: string
  is_active?: boolean
}

export interface UpdateAlertDto {
  payment_method_id?: number
  threshold_amount?: number
  telegram_chat_id?: string
  is_active?: boolean
}

export interface DailyPaymentMethodTotal {
  payment_method_id: number
  payment_method_name: string
  branch_name: string
  daily_total: number
}
