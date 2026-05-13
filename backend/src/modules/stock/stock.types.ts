export type MovementType =
  | 'IN_PURCHASE' | 'IN_TRANSFER' | 'IN_RETURN' | 'IN_PRODUCTION'
  | 'IN_ADJUSTMENT' | 'IN_OPENING'
  | 'OUT_TRANSFER' | 'OUT_LOAN' | 'OUT_DAILY' | 'OUT_ADJUSTMENT'
  | 'OUT_WASTE' | 'OUT_PRODUCTION'

export type ReferenceType =
  | 'purchase_order' | 'transfer_order' | 'branch_loan'
  | 'daily_requisition' | 'production_order' | 'adjustment' | 'opening'
  | 'goods_processing'

export interface StockBalance {
  id: string
  warehouse_id: string
  product_id: string
  qty: number
  avg_cost: number
  last_movement_at: string | null
  created_at: string
  updated_at: string
}

export interface StockBalanceWithRelations extends StockBalance {
  warehouse_code: string
  warehouse_name: string
  warehouse_type: string
  branch_name: string
  product_code: string
  product_name: string
  base_unit_name: string | null
}

export interface StockMovement {
  id: string
  warehouse_id: string
  product_id: string
  movement_type: MovementType
  qty: number
  cost_per_unit: number
  total_cost: number
  balance_after: number
  reference_type: ReferenceType | null
  reference_id: string | null
  notes: string | null
  movement_date: string
  created_at: string
  created_by: string | null
}

export interface StockMovementWithRelations extends StockMovement {
  warehouse_code: string
  warehouse_name: string
  product_code: string
  product_name: string
  created_by_name: string | null
}

// DTOs
export interface CreateMovementDto {
  warehouse_id: string
  product_id: string
  movement_type: MovementType
  qty: number
  cost_per_unit: number
  reference_type?: ReferenceType
  reference_id?: string
  notes?: string
  movement_date?: string
  created_by?: string
}

export interface CreateOpeningBalanceDto {
  warehouse_id: string
  product_id: string
  qty: number
  cost_per_unit: number
  notes?: string
  created_by?: string
}

export interface AdjustStockDto {
  warehouse_id: string
  product_id: string
  new_qty: number
  cost_per_unit?: number
  reason: string
  created_by?: string
}

export interface StockBalanceFilter {
  warehouse_id?: string
  branch_id?: string
  warehouse_type?: string
  product_id?: string
  has_stock?: boolean
}

export interface StockMovementFilter {
  warehouse_id?: string
  product_id?: string
  movement_type?: MovementType
  date_from?: string
  date_to?: string
}
