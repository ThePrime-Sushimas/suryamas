// ─── STATUS TYPES ─────────────────────────────────────────────────────────────

export type MonthlyOpnameStatus = 'DRAFT' | 'CONFIRMED' | 'REOPENED'
export type MonthlyOpnameScope = 'ALL_PRODUCTS' | 'BY_POSITION'

// ─── REOPEN TYPES ─────────────────────────────────────────────────────────────

export type ReopenRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface MonthlyOpnameReopenRequest {
  id: string
  opname_id: string
  requested_by: string
  requested_at: string
  reason: string
  status: ReopenRequestStatus
  responded_by: string | null
  responded_at: string | null
  response_note: string | null
  created_at: string
  updated_at: string
}

export interface MonthlyOpnameReopenRequestWithRelations extends MonthlyOpnameReopenRequest {
  requested_by_name: string
  responded_by_name: string | null
  opname_date: string
  branch_name: string
}

export interface CreateReopenRequestDto {
  reason: string
}

export interface RespondReopenRequestDto {
  response_note?: string
}

// ─── DOMAIN MODELS ────────────────────────────────────────────────────────────

export interface MonthlyStockOpname {
  id: string
  company_id: string
  branch_id: string
  warehouse_id: string
  opname_number: string
  opname_date: string
  scope: MonthlyOpnameScope
  position_id: string | null
  status: MonthlyOpnameStatus
  pic_user_id: string
  snapshot_taken_at: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  reopened_at: string | null
  reopened_by: string | null
  notes: string | null
  total_lines: number
  completed_lines: number
  total_selisih_value: number
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface MonthlyStockOpnameWithRelations extends MonthlyStockOpname {
  branch_name: string
  branch_code: string
  warehouse_name: string
  pic_name: string
  position_name: string | null
  position_code: string | null
  confirmed_by_name: string | null
  reopened_by_name: string | null
}

export interface MonthlyStockOpnameLine {
  id: string
  opname_id: string
  product_id: string
  product_code: string
  product_name: string
  uom: string
  snapshot_qty: number
  movement_during_so: number
  expected_qty: number
  actual_qty: number | null
  selisih_qty: number | null
  selisih_value: number | null
  cost_per_unit: number
  investigasi_note: string | null
  photo_url: string | null
  out_movement_id: string | null
  in_movement_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MonthlyStockOpnameDetail extends MonthlyStockOpnameWithRelations {
  lines: MonthlyStockOpnameLine[]
  summary: MonthlyOpnameSummary
}

export interface MonthlyOpnameSummary {
  total_products: number
  completed_products: number
  products_with_selisih: number
  total_selisih_value: number
  completion_pct: number
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateMonthlyOpnameDto {
  branch_id: string
  warehouse_id: string
  opname_date: string        // YYYY-MM-DD
  scope: MonthlyOpnameScope
  position_id?: string       // required if scope = BY_POSITION
  notes?: string
}

export interface UpdateLineDto {
  actual_qty: number
  investigasi_note?: string | null
}

export interface BulkUpdateLinesDto {
  lines: {
    line_id: string
    actual_qty: number
    investigasi_note?: string | null
  }[]
}

// ─── THERMAL PRINT ────────────────────────────────────────────────────────────

export interface MonthlyOpnameThermalData {
  opname_number: string
  warehouse_name: string
  branch_name: string
  opname_date: string
  pic_name: string
  confirmed_at: string
  lines: {
    product_code: string
    product_name: string
    uom: string
    snapshot_qty: number
    expected_qty: number
    actual_qty: number
    selisih_qty: number
    selisih_value: number
    investigasi_note: string | null
  }[]
  summary: {
    total_products: number
    products_with_selisih: number
    total_selisih_value: number
  }
}

// ─── LIST FILTERS ─────────────────────────────────────────────────────────────

export interface MonthlyOpnameListFilter {
  branch_id?: string
  warehouse_id?: string
  status?: MonthlyOpnameStatus
  date_from?: string
  date_to?: string
}
