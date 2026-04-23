export type CashCountStatus = 'OPEN' | 'COUNTED' | 'DEPOSITED' | 'CLOSED'
export type CashDepositStatus = 'PENDING' | 'DEPOSITED' | 'RECONCILED'

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
  large_denomination: number | null
  small_denomination: number | null
  difference: number | null
  status: CashCountStatus
  cash_deposit_id: string | null
  responsible_employee_id: string | null
  notes: string | null
  counted_by: string | null
  counted_at: string | null
  closed_by: string | null
  closed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CashCountWithRelations extends CashCount {
  payment_method_name?: string | null
  responsible_employee_name?: string | null
}

export interface CashDeposit {
  id: string
  company_id: string
  deposit_amount: number
  large_amount: number | null
  owner_top_up: number | null
  deposit_date: string
  bank_account_id: number
  reference: string | null
  bank_statement_id: string | null
  status: CashDepositStatus
  branch_name: string | null
  payment_method_id: number | null
  period_start: string | null
  period_end: string | null
  item_count: number
  notes: string | null
  proof_url: string | null
  deposited_at: string | null
  deposited_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CashDepositWithRelations extends CashDeposit {
  bank_account_name?: string | null
  items?: CashCount[]
}

export interface CreateCashCountDto {
  start_date: string
  end_date: string
  branch_name?: string | null
  payment_method_id: number
  notes?: string
}

export interface UpdatePhysicalCountDto {
  large_denomination: number
  small_denomination: number
  responsible_employee_id?: string | null
  notes?: string
}

export interface CreateDepositDto {
  cash_count_ids: string[]
  deposit_date: string
  bank_account_id: number
  deposit_amount?: number
  reference?: string
  notes?: string
}

export interface ConfirmDepositDto {
  proof_url: string
  deposited_at?: string
}

export interface CashCountListQuery {
  page?: number
  limit?: number
  branch_name?: string
  payment_method_id?: number
  status?: CashCountStatus
  start_date?: string
  end_date?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
