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

export interface PaymentMethodAlertHistory {
  id: string
  alert_id: string
  payment_method_id: number | null
  payment_method_name: string
  alert_group_id: string | null
  alert_group_name: string | null
  company_id: string
  triggered_date: string
  triggered_amount: number
  threshold_amount: number
  branch_breakdown: BranchBreakdown[]
  telegram_chat_id: string
  telegram_sent_at: string
  created_at: string
  alert_is_active?: boolean
  alert_group_is_active?: boolean
}

export interface BranchBreakdown {
  branch_name: string
  amount: number
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

export interface AlertHistoryFilters {
  start_date?: string
  end_date?: string
  payment_method_id?: number
  page?: number
  limit?: number
}

// --- Alert Groups (combined payment methods) ---

export interface PaymentMethodAlertGroup {
  id: string
  name: string
  payment_method_ids: number[]
  payment_method_names?: string[]
  threshold_amount: number
  telegram_chat_id: string
  is_active: boolean
  last_triggered_date: string | null
  last_triggered_amount: number
  created_at: string
  updated_at: string
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

