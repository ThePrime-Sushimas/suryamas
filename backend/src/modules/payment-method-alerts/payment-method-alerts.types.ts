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

export interface PaymentMethodAlertHistory {
  id: string
  alert_id: string
  payment_method_id: number
  payment_method_name: string
  company_id: string
  triggered_date: string
  triggered_amount: number
  threshold_amount: number
  branch_breakdown: BranchBreakdown[]
  telegram_chat_id: string
  telegram_sent_at: string
  created_at: string
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

export interface DailyPaymentMethodTotal {
  payment_method_id: number
  payment_method_name: string
  branch_name: string
  daily_total: number
}

export interface AlertHistoryFilters {
  start_date?: string
  end_date?: string
  payment_method_id?: number
  page?: number
  limit?: number
}
