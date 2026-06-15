export type AdjustmentType = 'WASTE' | 'BREAKDOWN'
export type AdjustmentStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
export type AdjustmentReason = 'EXPIRED' | 'DAMAGED' | 'CONTAMINATED' | 'OVERSTOCK' | 'PROCESSING_LOSS' | 'OTHER'

export interface StockAdjustment {
  id: string
  company_id: string
  branch_id: string
  warehouse_id: string
  adjustment_number: string
  adjustment_type: AdjustmentType
  status: AdjustmentStatus
  adjustment_date: string
  reason: AdjustmentReason | null
  notes: string | null
  // BREAKDOWN only
  input_product_id: string | null
  input_qty: number | null
  input_cost_per_unit: number
  input_movement_id: string | null
  waste_qty: number
  waste_value: number
  journal_id: string | null
  source_closing_id: string | null
  source_position_id: string | null
  source_monthly_opname_id: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  deleted_at: string | null
}

export interface StockAdjustmentWithRelations extends StockAdjustment {
  branch_name: string
  warehouse_name: string
  source_position_name: string | null
  // BREAKDOWN: input product info
  input_product_code: string | null
  input_product_name: string | null
  input_base_unit_name: string | null
  confirmed_by_name: string | null
  line_count: number
  output_count: number
}

// WASTE lines
export interface StockAdjustmentLine {
  id: string
  stock_adjustment_id: string
  product_id: string
  qty: number
  cost_per_unit: number
  movement_id: string | null
  notes: string | null
  sort_order: number
  created_at: string
}

export interface StockAdjustmentLineWithRelations extends StockAdjustmentLine {
  product_code: string
  product_name: string
  base_unit_name: string | null
  station: string | null
}

// BREAKDOWN outputs
export interface StockAdjustmentOutput {
  id: string
  stock_adjustment_id: string
  product_id: string
  qty: number
  cost_per_unit: number
  movement_id: string | null
  notes: string | null
  sort_order: number
  created_at: string
}

export interface StockAdjustmentOutputWithRelations extends StockAdjustmentOutput {
  product_code: string
  product_name: string
  base_unit_name: string | null
}

export interface StockAdjustmentDetail extends StockAdjustmentWithRelations {
  lines: StockAdjustmentLineWithRelations[]       // WASTE lines
  outputs: StockAdjustmentOutputWithRelations[]   // BREAKDOWN outputs
}

// DTOs
export interface CreateStockAdjustmentDto {
  adjustment_type: AdjustmentType
  warehouse_id: string
  adjustment_date: string
  reason?: AdjustmentReason | null
  notes?: string | null
  // WASTE: multiple products
  lines?: {
    product_id: string
    qty: number
    notes?: string | null
  }[]
  // BREAKDOWN: single input + multiple outputs
  input_product_id?: string
  input_qty?: number
  outputs?: {
    product_id: string
    qty: number
    notes?: string | null
  }[]
  created_by?: string
  source_closing_id?: string | null
  source_position_id?: string | null
  source_monthly_opname_id?: string | null
}

export interface CreateStockAdjustmentFromShortageDto {
  warehouse_id: string
  branch_id: string
  company_id: string
  adjustment_date: string
  notes: string
  source_closing_id?: string | null
  source_monthly_opname_id?: string | null
  source_position_id?: string | null
  lines: { product_id: string; qty: number; notes?: string | null }[]
  created_by: string
}

export interface ConfirmStockAdjustmentDto {
  confirmed_by: string
}

export interface CancelStockAdjustmentDto {
  cancelled_by: string
}
