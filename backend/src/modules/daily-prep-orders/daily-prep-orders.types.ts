export type DpoStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'

export interface DailyPrepOrder {
  id: string
  company_id: string
  branch_id: string
  dpo_number: string
  prep_date: string
  status: DpoStatus
  source_warehouse_id: string
  target_warehouse_id: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor_applied: number
  has_upcoming_holiday: boolean
  confirmed_at: string | null
  confirmed_by: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  lock_token: string | null
  locked_at: string | null
  locked_by: string | null
  notes: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface DailyPrepOrderLine {
  id: string
  dpo_id: string
  product_id: string
  avg_sales_7d: number
  avg_sales_30d: number
  avg_sales_dow: number
  holiday_factor: number
  coverage_days: number
  predicted_need: number
  current_ready_stock: number
  current_main_stock: number
  suggested_qty: number
  confirmed_qty: number | null
  uom: string
  out_movement_id: string | null
  in_movement_id: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DailyPrepOrderWithRelations extends DailyPrepOrder {
  branch_name: string
  branch_code: string
  source_warehouse_name: string
  target_warehouse_name: string
  confirmed_by_name: string | null
  line_count: number
}

export interface DailyPrepOrderLineWithRelations extends DailyPrepOrderLine {
  product_code: string
  product_name: string
  base_unit_name: string | null
  // Stok saat ini (live, bukan snapshot)
  live_ready_stock: number
  live_main_stock: number
}

export interface DailyPrepOrderDetail extends DailyPrepOrderWithRelations {
  lines: DailyPrepOrderLineWithRelations[]
}

export interface DpoForecastConfig {
  id: string
  company_id: string
  branch_id: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor: number
  lookback_days_short: number
  lookback_days_long: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface PublicHoliday {
  id: string
  company_id: string
  holiday_date: string
  holiday_name: string
  created_at: string
  created_by: string | null
}

// DTOs
export interface GenerateDpoDto {
  branch_id: string
  prep_date: string          // tanggal operasional yang disiapkan (biasanya besok)
  source_warehouse_id: string
  target_warehouse_id: string
  notes?: string | null
  created_by?: string
}

export interface UpdateDpoLinesDto {
  lines: {
    id: string
    confirmed_qty: number | null
    notes?: string | null
  }[]
  updated_by?: string
}

export interface ConfirmDpoDto {
  lock_token: string
  confirmed_by: string
}

export interface UpsertForecastConfigDto {
  branch_id: string
  weight_7d: number
  weight_30d: number
  weight_dow: number
  coverage_days: number
  holiday_factor: number
  lookback_days_short?: number
  lookback_days_long?: number
}

export interface UpsertHolidayDto {
  holiday_date: string
  holiday_name: string
}

// Internal — hasil kalkulasi prediksi per produk
export interface DpoForecastLine {
  product_id: string
  product_name: string
  product_code: string
  uom: string
  avg_sales_7d: number
  avg_sales_30d: number
  avg_sales_dow: number
  predicted_need: number
  current_ready_stock: number
  current_main_stock: number
  suggested_qty: number
  transfer_conversion_factor: number
  transfer_unit_name: string
}