export type CashCountStatus = 'OPEN' | 'COUNTED' | 'DEPOSITED' | 'CLOSED'

export interface CashCount {
  id: string
  company_id: string
  start_date: string
  end_date: string
  branch_name: string | null
  payment_method_id: number
  system_balance: number
  transaction_count: number
  physical_count: number | null
  difference: number | null
  status: CashCountStatus
  deposit_amount: number | null
  deposit_date: string | null
  deposit_bank_account_id: number | null
  deposit_reference: string | null
  responsible_employee_id: string | null
  notes: string | null
  counted_by: string | null
  counted_at: string | null
  deposited_by: string | null
  deposited_at: string | null
  closed_by: string | null
  closed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Joined
  branch_name?: string | null
  payment_method_name?: string | null
  responsible_employee_name?: string | null
  deposit_bank_name?: string | null
  details?: CashCountDetail[]
}

export interface CashCountDetail {
  id: string
  cash_count_id: string
  transaction_date: string
  amount: number
  transaction_count: number
  notes: string | null
  created_at: string
}

export interface CreateCashCountDto {
  start_date: string
  end_date: string
  branch_name?: string | null
  payment_method_id: number
  notes?: string
}

export interface UpdatePhysicalCountDto {
  physical_count: number
  responsible_employee_id?: string | null
  notes?: string
}

export interface DepositDto {
  deposit_amount: number
  deposit_date: string
  deposit_bank_account_id: number
  deposit_reference?: string
  notes?: string
}

export interface CashCountListFilter {
  page?: number
  limit?: number
  branch_id?: string
  payment_method_id?: number
  status?: CashCountStatus
  start_date?: string
  end_date?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
