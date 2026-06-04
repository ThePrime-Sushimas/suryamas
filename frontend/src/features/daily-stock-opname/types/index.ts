// ─── STATUS TYPES ─────────────────────────────────────────────────────────────

export type OpnameStatus = 'DRAFT' | 'CONFIRMED' | 'FLAGGED' | 'REOPENED'
export type OpnameDisplayStatus = OpnameStatus | 'MISSED' | 'NOT_STARTED'

// ─── REOPEN TYPES ─────────────────────────────────────────────────────────────

export type ReopenRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface OpnameReopenRequest {
  id: string
  closing_id: string
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

export interface OpnameReopenRequestWithRelations extends OpnameReopenRequest {
  requested_by_name: string
  responded_by_name: string | null
  closing_date: string
  branch_name: string
}

export interface CreateReopenRequestDto {
  reason: string
}

export interface RespondReopenRequestDto {
  response_note?: string
}

// ─── DOMAIN MODELS ────────────────────────────────────────────────────────────

export interface DailyClosingCount {
  id: string
  company_id: string
  branch_id: string
  warehouse_id: string
  position_id: string | null
  closing_date: string
  pic_user_id: string
  status: OpnameStatus
  total_variance_cost: number
  total_expected_cost: number
  total_actual_cost: number
  line_count: number
  completed_count: number
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  notes: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // Relations (from joins)
  branch_name: string
  branch_code: string
  warehouse_name: string
  pic_name: string
  position_name: string | null
  position_code: string | null
  resolved_by_name: string | null
  confirmed_by_name: string | null
}

export interface DailyClosingCountLine {
  id: string
  closing_id: string
  product_id: string
  product_code: string
  product_name: string
  uom: string
  system_qty: number
  expected_qty: number
  actual_qty: number | null
  variance_qty: number | null
  variance_pct: number | null
  cost_per_unit: number
  variance_cost: number | null
  main_balance: number
  dpo_in_qty: number
  theoretical_out: number
  is_high_risk: boolean
  requires_photo: boolean
  photo_url: string | null
  has_recipe: boolean
  has_warning: boolean
  warning_message: string | null
  sort_order: number
  out_movement_id: string | null
  in_movement_id: string | null
}

export interface DailyClosingCountDetail extends DailyClosingCount {
  lines: DailyClosingCountLine[]
  summary: OpnameSummary
}

export interface OpnameSummary {
  total_expected_cost: number
  total_actual_cost: number
  total_variance_cost: number
  completion_pct: number
  line_count: number
  completed_count: number
  flagged_line_count: number
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateOpnameDto {
  branch_id: string
  closing_date: string      // YYYY-MM-DD
  position_id: string
  notes?: string
}

export interface UpdateLineDto {
  actual_qty: number
}

export interface BulkUpdateLinesDto {
  lines: { line_id: string; actual_qty: number }[]
}

export interface ResolveOpnameDto {
  resolution_note: string
}

export interface UpsertOpnameConfigDto {
  variance_threshold_pct?: number
  closing_time?: string // HH:mm format
  grace_period_minutes?: number
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────

export interface BranchOpnameConfig {
  id: string
  company_id: string
  branch_id: string
  variance_threshold_pct: number
  closing_time: string
  grace_period_minutes: number
  updated_by: string | null
  updated_at: string
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export interface OpnameDashboardItem {
  branch_id: string
  branch_name: string
  branch_code: string
  status: OpnameDisplayStatus
  session_id: string | null
  total_variance_cost: number | null
  completion_pct: number | null
  closing_date: string | null
}

// ─── ANALYSIS ─────────────────────────────────────────────────────────────────

export interface AnalysisLineItem {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  stok_kemarin: number
  barang_masuk: number
  stok_hari_ini: number
  waste: number
  total_konversi: number
  pemakaian_riil: number
  pemakaian_pos: number
  gap: number
  has_recipe: boolean
}

export interface AnalysisResponse {
  session_id: string
  closing_date: string
  branch_name: string
  lines: AnalysisLineItem[]
  summary: {
    total_pemakaian_riil: number
    total_pemakaian_pos: number
    total_gap: number
  }
}

// ─── CLASSIFICATION ───────────────────────────────────────────────────────────

export interface ClassifyLineEntry {
  line_id: string
  variance_category: 'WASTE' | 'SHORTAGE'
  qty: number
  shortage_assigned_to: string | null
  shortage_note: string | null
}

export interface ClassifyDto {
  entries: ClassifyLineEntry[]
}

export interface ClassificationEntry extends ClassifyLineEntry {
  id: string
  classified_by: string
  classified_at: string
  product_name: string
  product_code: string
  uom: string
  assigned_employee_name: string | null
}

export interface ClassificationSummary {
  waste_total: number
  shortage_total: number
  entry_count: number
  is_complete: boolean
  classification_version: number
}

export interface ClassificationsResponse {
  entries: ClassificationEntry[]
  summary: ClassificationSummary
}

// ─── VARIANCE REPORT ──────────────────────────────────────────────────────────

export interface VarianceReportItem {
  product_id: string
  product_code: string
  product_name: string
  uom: string
  risk_category: string
  total_variance_qty: number
  total_variance_cost: number
  avg_variance_pct: number
  session_count: number
  flagged_count: number
}

export interface VarianceReportFilter {
  date_from: string
  date_to: string
  branch_id?: string
  product_id?: string
  risk_category?: string
  group_by?: 'day' | 'week' | 'month'
}
