// ============================================================
// PETTY CASH MODULE — Types
// ============================================================

export type PettyCashRequestStatus = 'PENDING' | 'DISBURSED' | 'CLOSED' | 'REJECTED'

// ─── DB Row Interfaces ──────────────────────────────────────

export interface PettyCashRequest {
  id: string
  company_id: string
  branch_id: string
  request_number: string
  status: PettyCashRequestStatus
  amount_requested: number
  amount_disbursed: number | null
  carried_from_id: string | null
  carried_amount: number
  petty_cash_coa_id: string
  source_bank_account_id: number | null
  disburse_journal_id: string | null
  description: string | null
  notes: string | null
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  closed_by: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface PettyCashSettlement {
  id: string
  request_id: string
  company_id: string
  branch_id: string
  settlement_date: string
  total_disbursed: number
  total_expenses: number
  remaining_balance: number
  amount_returned: number
  carried_to_id: string | null
  journal_id: string | null
  return_bank_account_id: number | null
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface PettyCashExpense {
  id: string
  request_id: string
  company_id: string
  branch_id: string
  expense_date: string
  amount: number
  description: string | null
  category_id: string
  sub_category_id: string | null
  expense_coa_id: string | null
  product_id: string | null
  product_uom_id: string | null
  qty: number | null
  unit_price: number | null
  warehouse_id: string | null
  stock_movement_id: string | null
  settlement_id: string | null
  receipt_url: string | null
  fixed_asset_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

// ─── DTOs ──────────────────────────────────────────────────────

export interface CreateRequestDto {
  branch_id: string
  amount_requested: number
  petty_cash_coa_id: string
  description?: string
}

export interface ApproveRequestDto {
  source_bank_account_id: number
  amount_disbursed: number
  notes?: string
}

export interface RejectRequestDto {
  rejection_reason: string
}

export interface CreateExpenseDto {
  expense_date?: string
  amount: number
  description?: string
  category_id: string
  sub_category_id?: string
  expense_coa_id?: string
  // Inventory mode
  product_id?: string
  product_uom_id?: string
  qty?: number
  unit_price?: number
  warehouse_id?: string
  receipt_url?: string
  // Asset mode
  asset_category_id?: string
  asset_name?: string
  asset_qty?: number
  useful_life_months?: number
  salvage_value?: number
}

export interface UpdateExpenseDto {
  expense_date?: string
  amount?: number
  description?: string
  category_id?: string
  sub_category_id?: string
  expense_coa_id?: string
  product_id?: string
  product_uom_id?: string
  qty?: number
  unit_price?: number
  warehouse_id?: string
  receipt_url?: string
}

export interface CreateSettlementDto {
  settlement_date?: string
  amount_returned: number
  return_bank_account_id?: number
  refill_amount?: number
  refill_bank_account_id?: number
  notes?: string
}

export interface VoidSettlementDto {
  reason: string
}
