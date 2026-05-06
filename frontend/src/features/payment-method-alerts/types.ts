export interface PaymentMethodAlert {
  id: string
  payment_method_id: number
  payment_method_name?: string
  threshold_amount: number
  telegram_chat_id: string
  is_active: boolean
  last_triggered_date: string | null
  last_triggered_amount: number
  created_at: string
  updated_at: string
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

export interface PaymentMethod {
  id: number
  name: string
}