export type WarehouseType = 'MAIN' | 'READY' | 'FINISHED_GOODS'

export interface Warehouse {
  id: string
  company_id: string
  branch_id: string
  warehouse_code: string
  warehouse_name: string
  warehouse_type: WarehouseType
  is_active: boolean
  is_deleted: boolean
  branch_name: string
  branch_code: string
  created_at: string
  updated_at: string
}

export interface CreateWarehouseDto {
  branch_id: string
  warehouse_code: string
  warehouse_name: string
  warehouse_type?: WarehouseType
  is_active?: boolean
}

export interface UpdateWarehouseDto {
  warehouse_name?: string
  warehouse_type?: WarehouseType
  is_active?: boolean
}

export type MovementType =
  | 'IN_PURCHASE' | 'IN_TRANSFER' | 'IN_RETURN' | 'IN_PRODUCTION'
  | 'IN_ADJUSTMENT' | 'IN_OPENING' | 'IN_REVERSAL'
  | 'OUT_TRANSFER' | 'OUT_LOAN' | 'OUT_DAILY' | 'OUT_ADJUSTMENT'
  | 'OUT_WASTE' | 'OUT_PRODUCTION' | 'OUT_REVERSAL'
  | 'OUT_SALES'

export interface StockBalance {
  id: string
  warehouse_id: string
  product_id: string
  qty: number
  avg_cost: number
  last_movement_at: string | null
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
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  movement_date: string
  created_at: string
  warehouse_code: string
  warehouse_name: string
  product_code: string
  product_name: string
  created_by_name: string | null
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}
