export type PricelistStatus = 'DRAFT' | 'APPROVED' | 'EXPIRED' | 'REJECTED'
export type PricelistSource = 'MANUAL' | 'PI_POST' | 'PI_UNPOST'
export type PricelistChangeSource = 'PI_POST' | 'PI_UNPOST' | 'MANUAL'

export interface Pricelist {
  id: string
  company_id: string
  supplier_id: string
  product_id: string
  uom_id: string
  price: number
  currency: string
  valid_from: string
  valid_to: string | null
  status: PricelistStatus
  is_active: boolean
  source: PricelistSource
  purchase_invoice_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
}

export interface PricelistSyncWarning {
  product_name: string
  uom_invoice: string
  reason: string
}

export interface PricelistSyncResult {
  synced: number
  skipped: number
  warnings: PricelistSyncWarning[]
}

export interface InsertPriceChangeInput {
  company_id: string
  supplier_id: string
  product_id: string
  uom_id: string
  old_price: number | null
  new_price: number
  effective_date: string
  source: PricelistChangeSource
  purchase_invoice_id?: string | null
  purchase_invoice_line_id?: string | null
  pricelist_id?: string | null
  created_by?: string | null
}

export interface UnpostPricelistBlockedItem {
  product_name: string
  uom_name: string
  superseding_invoice_number: string | null
}

export type PiLineForPricelistSync = {
  id: string
  product_id: string
  product_name: string
  unit_price: number
  uom_invoice: string
  uom_id: string | null
}

export interface PriceChangeWithRelations {
  id: string
  company_id: string
  supplier_id: string
  product_id: string
  uom_id: string
  old_price: number | null
  new_price: number
  change_amount: number | null
  change_pct: number | null
  effective_date: string
  source: PricelistChangeSource
  purchase_invoice_id: string | null
  purchase_invoice_line_id: string | null
  pricelist_id: string | null
  created_at: string
  supplier_name: string
  product_name: string
  product_code: string | null
  uom_name: string
  invoice_number: string | null
  /** Last N prices for combo ending at this change (chronological, for sparkline) */
  recent_prices: number[]
}

export interface PriceChangeSummary {
  up_count: number
  down_count: number
  avg_change_pct: number | null
}

export interface PriceChangeListQuery {
  page?: number
  limit?: number
  supplier_id?: string
  product_id?: string
  uom_id?: string
  source?: PricelistChangeSource
  date_from?: string
  date_to?: string
  search?: string
}

export interface PriceChangeChartQuery {
  supplier_id: string
  product_id: string
  uom_id: string
  limit?: number
  days?: number
}

export interface PriceChangeChartPoint {
  effective_date: string
  new_price: number
  change_pct: number | null
  source: PricelistChangeSource
}

export interface PriceChangeChartResult {
  points: PriceChangeChartPoint[]
  active_price: number | null
}

export interface PricelistWithRelations extends Pricelist {
  supplier_name?: string
  product_name?: string
  uom_name?: string
  supplier?: {
    id: string
    supplier_code?: string
    supplier_name: string
  }
  product?: {
    id: string
    product_code?: string
    product_name: string
  }
  uom?: {
    id: string
    uom_code?: string
    uom_name: string
  }
}

export interface CreatePricelistDto {
  company_id: string
  supplier_id: string
  product_id: string
  uom_id: string
  price: number
  currency?: string
  valid_from: string
  valid_to?: string | null
  is_active?: boolean
  created_by?: string
}

export interface UpdatePricelistDto {
  price?: number
  currency?: string
  valid_from?: string
  valid_to?: string | null
  is_active?: boolean
  status?: PricelistStatus
  updated_by?: string
  updated_at?: string
}

export interface PricelistListQuery {
  page?: number
  limit?: number
  supplier_id?: string
  product_id?: string
  status?: PricelistStatus
  is_active?: boolean
  include_deleted?: boolean
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PricelistApprovalDto {
  status: 'APPROVED' | 'REJECTED'
}

export interface PricelistLookup {
  supplier_id: string
  product_id: string
  uom_id: string
  date?: string
}
