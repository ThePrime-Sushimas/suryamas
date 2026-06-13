export type MovementType =
  | 'IN_PURCHASE' | 'IN_TRANSFER' | 'IN_RETURN' | 'IN_PRODUCTION'
  | 'IN_ADJUSTMENT' | 'IN_OPENING' | 'IN_REVERSAL' | 'IN_DAILY'
  | 'OUT_TRANSFER' | 'OUT_LOAN' | 'OUT_DAILY' | 'OUT_ADJUSTMENT'
  | 'OUT_WASTE' | 'OUT_PRODUCTION' | 'OUT_PROCESSING' | 'OUT_REVERSAL'

export type ReferenceType =
  | 'purchase_order' | 'transfer_order' | 'branch_loan'
  | 'daily_requisition' | 'production_order' | 'adjustment' | 'opening'
  | 'goods_processing' | 'daily_closing_count' | 'monthly_stock_opname'

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
  movement_date?: string
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

// ─── STOCK CONFIG ─────────────────────────────────────────────────────────────

export interface ProductStockConfig {
  id: string
  company_id: string
  branch_id: string
  product_id: string
  warehouse_id: string | null
  reorder_point: number | null
  safety_stock: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StockConfigGridRow {
  product_id: string
  product_code: string
  product_name: string
  category_name: string
  base_unit_name: string | null
  configs: {
    branch_id: string
    reorder_point: number | null
    safety_stock: number | null
  }[]
}

export interface UpsertStockConfigDto {
  branch_id: string
  product_id: string
  reorder_point?: number | null
  safety_stock?: number | null
  notes?: string | null
}

// ─── REORDER SUGGESTIONS ──────────────────────────────────────────────────────

export interface ReorderSuggestionItem {
  // Produk
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null

  // Lokasi
  branch_id: string
  branch_name: string
  warehouse_id: string
  warehouse_name: string

  // Stok
  current_qty: number
  reorder_point: number
  safety_stock: number | null
  shortage: number
  is_critical: boolean

  // On order (PO aktif belum fully received)
  qty_on_order: number
  still_short_after_order: boolean

  // Supplier
  preferred_supplier_id: string | null
  preferred_supplier_name: string | null
  lead_time_days: number | null
  last_purchase_price: number | null

  // Config source
  config_source: 'branch' | 'product_default'
}
