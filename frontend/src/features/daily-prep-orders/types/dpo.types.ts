// Daily Prep Orders — Type Definitions

export type DpoStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'

export interface DailyPrepOrderWithRelations {
  id: string
  company_id: string
  branch_id: string
  branch_name: string
  branch_code: string
  dpo_number: string
  prep_date: string
  status: DpoStatus
  source_warehouse_id: string
  source_warehouse_name: string
  target_warehouse_id: string
  target_warehouse_name: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor_applied: number
  has_upcoming_holiday: boolean
  confirmed_at: string | null
  confirmed_by: string | null
  confirmed_by_name: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  lock_token: string | null
  locked_at: string | null
  notes: string | null
  line_count: number
  created_at: string
  updated_at: string
}

export interface DailyPrepOrderLineWithRelations {
  id: string
  dpo_id: string
  product_id: string
  product_code: string
  product_name: string
  uom: string
  avg_sales_7d: number
  avg_sales_30d: number
  avg_sales_dow: number
  holiday_factor: number
  coverage_days: number
  predicted_need: number
  current_ready_stock: number
  live_ready_stock: number
  current_main_stock: number
  live_main_stock: number
  suggested_qty: number
  confirmed_qty: number | null
  out_movement_id: string | null
  in_movement_id: string | null
  notes: string | null
  sort_order: number
}

export interface DailyPrepOrderDetail extends DailyPrepOrderWithRelations {
  lines: DailyPrepOrderLineWithRelations[]
}

export interface DpoForecastConfig {
  id: string
  branch_id: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor: number
  lookback_days_short: number
  lookback_days_long: number
  is_active: boolean
}

export interface PublicHoliday {
  id: string
  company_id: string
  holiday_date: string
  holiday_name: string
  created_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// --- API Request Types ---

export interface DpoListParams {
  page?: number
  limit?: number
  branch_id?: string
  status?: DpoStatus | ''
  date_from?: string
  date_to?: string
}

export interface GenerateDpoBody {
  branch_id: string
  prep_date: string
  source_warehouse_id: string
  target_warehouse_id: string
  notes?: string | null
}

export interface UpdateLinesBody {
  lines: { id: string; confirmed_qty: number | null; notes?: string | null }[]
}

export interface UpsertConfigBody {
  branch_id: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor: number
  lookback_days_short?: number
  lookback_days_long?: number
}
