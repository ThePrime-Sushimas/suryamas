// ─── Type Unions ──────────────────────────────────────────────────────────────

export type AssetStatus = 'DRAFT' | 'ACTIVE' | 'MAINTENANCE' | 'DISPOSED'

export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE'

export type DisposalMethod = 'SOLD' | 'SCRAPPED' | 'DONATED'

export type MovementType =
  | 'CAPITALIZE'
  | 'DEPRECIATION'
  | 'TRANSFER'
  | 'MAINTENANCE'
  | 'MAINTENANCE_COMPLETE'
  | 'DISPOSAL'
  | 'COST_ADJUSTMENT'
  | 'OPENING_BALANCE'

export type MaintenanceStatus = 'IN_PROGRESS' | 'COMPLETED' | 'POSTED'

export type DepreciationRunStatus = 'PREVIEW' | 'POSTED' | 'REVERSED'

export type TrackingMethod = 'INDIVIDUAL' | 'POOLED'

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface AssetCategory {
  id: string
  company_id: string
  category_code: string
  category_name: string
  asset_coa_id: string
  depreciation_expense_coa_id: string
  accumulated_depreciation_coa_id: string
  default_useful_life_months: number
  tracking_method: TrackingMethod
  is_active: boolean
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // Joined COA info
  asset_coa_code?: string
  asset_coa_name?: string
  depreciation_expense_coa_code?: string
  depreciation_expense_coa_name?: string
  accumulated_depreciation_coa_code?: string
  accumulated_depreciation_coa_name?: string
}

export interface FixedAsset {
  id: string
  company_id: string
  branch_id: string
  asset_code: string
  asset_name: string
  asset_category_id: string
  product_id: string | null
  status: AssetStatus
  acquisition_date: string
  capitalized_date: string | null
  cost: number
  salvage_value: number
  useful_life_months: number
  depreciation_method: DepreciationMethod
  accumulated_depreciation: number
  book_value: number
  quantity: number
  uom: string
  gr_line_id: string | null
  purchase_invoice_id: string | null
  journal_id: string | null
  qr_code_url: string | null
  photo_url: string | null
  description: string | null
  serial_number: string | null
  location_note: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // Joined fields
  branch_name?: string
  category_name?: string
  category_code?: string
  tracking_method?: TrackingMethod
  thumbnail_path?: string | null
  thumbnail_url?: string | null
}

export interface AssetTransfer {
  id: string
  company_id: string
  fixed_asset_id: string
  transfer_date: string
  source_branch_id: string
  destination_branch_id: string
  reason: string | null
  transferred_by: string | null
  journal_posted: boolean
  source_journal_id: string | null
  target_journal_id: string | null
  created_at: string
  created_by: string | null
  // Joined fields
  asset_code?: string
  asset_name?: string
  source_branch_name?: string
  destination_branch_name?: string
}

export interface AssetMaintenance {
  id: string
  company_id: string
  fixed_asset_id: string
  maintenance_date: string
  completion_date: string | null
  description: string
  vendor_id: string | null
  vendor_name: string | null
  cost: number
  reference_number: string | null
  status: MaintenanceStatus
  journal_id: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  // Joined fields
  asset_code?: string
  asset_name?: string
  asset_branch_id?: string
}

export interface AssetDisposal {
  id: string
  company_id: string
  fixed_asset_id: string
  disposal_date: string
  disposal_method: DisposalMethod
  proceeds_amount: number
  book_value_at_disposal: number
  gain_loss_amount: number
  quantity_disposed: number | null
  status: 'DRAFT' | 'POSTED'
  journal_id: string | null
  notes: string | null
  posted_by: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface DepreciationRun {
  id: string
  company_id: string
  fiscal_period_id: string
  run_date: string
  status: DepreciationRunStatus
  total_depreciation_amount: number
  asset_count: number
  journal_ids: string[]
  reversal_journal_ids: string[]
  reversed_at: string | null
  reversed_by: string | null
  created_at: string
  created_by: string | null
}

export interface DepreciationEntry {
  id: string
  depreciation_run_id: string
  fixed_asset_id: string
  depreciation_amount: number
  accumulated_before: number
  accumulated_after: number
  created_at: string
}

export interface AssetMovement {
  id: string
  company_id: string
  fixed_asset_id: string
  movement_type: MovementType
  movement_date: string
  from_value: string | null
  to_value: string | null
  reference_id: string | null
  reference_type: string | null
  notes: string | null
  created_at: string
  created_by: string | null
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateAssetFromGrDto {
  company_id: string
  branch_id: string
  product_id: string
  asset_category_id: string
  acquisition_date: string
  cost: number
  quantity: number
  uom: string
  useful_life_months?: number
  gr_line_id: string
  asset_name: string
  created_by: string
}

export interface CreateTransferDto {
  fixed_asset_id: string
  destination_branch_id: string
  transfer_date?: string
  reason?: string
}

export interface CreateMaintenanceDto {
  fixed_asset_id: string
  maintenance_date: string
  description: string
  vendor_id: string
}

export interface CreateDisposalDto {
  fixed_asset_id: string
  disposal_date: string
  disposal_method: DisposalMethod
  proceeds_amount: number
  quantity_disposed?: number | null
  notes?: string | null
}

export interface DepreciationPreviewEntry {
  fixed_asset_id: string
  asset_code: string
  asset_name: string
  cost: number
  salvage_value: number
  useful_life_months: number
  accumulated_before: number
  depreciation_amount: number
  accumulated_after: number
  book_value_after: number
}

export interface DepreciationRunResult {
  run_id: string
  status: DepreciationRunStatus
  fiscal_period_id: string
  total_depreciation_amount: number
  asset_count: number
  entries: DepreciationPreviewEntry[]
  journal_ids?: string[]
}

// ─── Opening Balance ─────────────────────────────────────────────────────────

export interface CreateOpeningBalanceDto {
  company_id: string
  branch_id: string
  asset_category_id: string
  product_id: string
  asset_name: string
  acquisition_date: string
  cost: number
  salvage_value: number
  useful_life_months?: number
  accumulated_depreciation: number
  quantity?: number
  uom?: string
  equity_coa_id: string
  serial_number?: string | null
  location_note?: string | null
  description?: string | null
  notes?: string | null
  created_by: string
}

export interface DepreciationPreviewRequest {
  acquisition_date: string
  cost: number
  salvage_value: number
  useful_life_months: number
}

export interface DepreciationPreviewResponse {
  months_elapsed: number
  estimated_accumulated_depreciation: number
  estimated_book_value: number
  monthly_depreciation: number
  is_fully_depreciated: boolean
}
