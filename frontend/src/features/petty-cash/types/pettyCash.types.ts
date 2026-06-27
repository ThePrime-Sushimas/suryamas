export type PettyCashRequestStatus = 'PENDING' | 'DISBURSED' | 'CLOSED' | 'REJECTED'

export interface PettyCashRequest {
  id: string
  request_number: string
  branch_id: string
  branch_name: string
  status: PettyCashRequestStatus
  petty_cash_coa_id: string
  petty_cash_coa_name: string
  amount_requested: number
  amount_disbursed: number | null
  carried_amount: number
  carried_from_id: string | null
  description: string | null
  notes: string | null
  submitted_by: string | null
  submitted_by_name: string | null
  approved_by: string | null
  approved_by_name: string | null
  rejected_by: string | null
  rejected_by_name: string | null
  closed_by: string | null
  closed_by_name: string | null
  source_bank_account_id: number | null
  source_bank_account_name: string | null
  source_bank_name: string | null
  disburse_journal_id: string | null
  rejection_reason: string | null
  approved_at: string | null
  rejected_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  // Computed
  total_disbursed: number
  total_expenses: number
  settlement_status: 'SETTLED' | null
  settlement_id: string | null
  expenses?: PettyCashExpense[]
}

export interface PettyCashExpense {
  id: string
  request_id: string
  category_id: string
  category_name: string
  category_code: string
  affects_inventory: boolean
  sub_category_id: string | null
  sub_category_name: string | null
  expense_date: string
  amount: number
  description: string | null
  product_id: string | null
  product_name: string | null
  product_code: string | null
  product_uom_id: string | null
  product_uom_name: string | null
  base_unit_name: string | null
  warehouse_id: string | null
  warehouse_name: string | null
  qty: number | null
  unit_price: number | null
  expense_coa_id: string | null
  expense_coa_name: string | null
  settlement_id: string | null
  stock_movement_id: string | null
  receipt_url: string | null
  created_at: string
  created_by_name: string | null
}

export interface PettyCashSettlement {
  id: string
  request_id: string
  settlement_date: string
  total_disbursed: number
  total_expenses: number
  remaining_balance: number
  amount_returned: number
  journal_id: string | null
  carried_to_id: string | null
  notes: string | null
  created_at: string
}

export interface PettyCashListQuery {
  branch_id?: string
  status?: PettyCashRequestStatus
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface UpdateExpenseDto {
  category_id?: string
  sub_category_id?: string | null
  expense_date?: string
  amount?: number
  description?: string | null
  product_id?: string | null
  product_uom_id?: string | null
  warehouse_id?: string | null
  qty?: number | null
  unit_price?: number | null
  expense_coa_id?: string | null
}
