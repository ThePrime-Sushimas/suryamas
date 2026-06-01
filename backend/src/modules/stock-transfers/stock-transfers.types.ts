export type TransferType = 'TRANSFER' | 'LOAN'
export type TransferStatus = 'DRAFT' | 'CONFIRMED' | 'RETURNED' | 'CANCELLED'

export interface StockTransfer {
  id: string
  company_id: string
  transfer_number: string
  transfer_type: TransferType
  status: TransferStatus
  source_warehouse_id: string
  target_warehouse_id: string
  source_branch_id: string
  target_branch_id: string
  transfer_date: string
  notes: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  returned_at: string | null
  returned_by: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  source_journal_id: string | null
  target_journal_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface StockTransferWithRelations extends StockTransfer {
  source_warehouse_name: string
  target_warehouse_name: string
  source_branch_name: string
  target_branch_name: string
  confirmed_by_name: string | null
  line_count: number
}

export interface StockTransferLine {
  id: string
  stock_transfer_id: string
  product_id: string
  qty: number
  cost_per_unit: number
  notes: string | null
  sort_order: number
  out_movement_id: string | null
  in_movement_id: string | null
  return_out_movement_id: string | null
  return_in_movement_id: string | null
  created_at: string
}

export interface StockTransferLineWithRelations extends StockTransferLine {
  product_code: string
  product_name: string
  base_unit_name: string | null
}

export interface StockTransferDetail extends StockTransferWithRelations {
  lines: StockTransferLineWithRelations[]
}

// DTOs
export interface CreateStockTransferDto {
  transfer_type?: TransferType
  source_warehouse_id: string
  target_warehouse_id: string
  transfer_date: string
  notes?: string | null
  lines: {
    product_id: string
    qty: number
    notes?: string | null
  }[]
  created_by?: string
}

export interface UpdateStockTransferDto {
  // transfer_type excluded — cannot change after creation
  source_warehouse_id: string
  target_warehouse_id: string
  transfer_date: string
  notes?: string | null
  lines: {
    product_id: string
    qty: number
    notes?: string | null
  }[]
  updated_by?: string
}

export interface ConfirmStockTransferDto {
  confirmed_by: string
}

export interface ReturnLoanDto {
  returned_by: string
  return_date: string // YYYY-MM-DD
}

export interface CancelStockTransferDto {
  cancel_reason?: string
  cancelled_by: string
}
