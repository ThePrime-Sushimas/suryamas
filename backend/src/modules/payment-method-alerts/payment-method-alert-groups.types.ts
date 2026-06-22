export interface PaymentMethodAlertGroup {
  id: string
  company_id: string
  name: string
  payment_method_ids: number[]
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
  payment_method_names?: string[]
}

export interface CreateAlertGroupDto {
  name: string
  payment_method_ids: number[]
  threshold_amount: number
  telegram_chat_id: string
  is_active?: boolean
}

export interface UpdateAlertGroupDto {
  name?: string
  payment_method_ids?: number[]
  threshold_amount?: number
  telegram_chat_id?: string
  is_active?: boolean
}
