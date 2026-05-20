/**
 * Pricelist Module Type Definitions
 * 
 * Type hierarchy:
 * - Base types (Pricelist, PricelistWithRelations)
 * - DTO types (Create, Update, Approval)
 * - Query types (List, Lookup)
 * - Response types (API responses)
 * 
 * @module pricelists/types
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Pricelist status lifecycle
 * DRAFT → APPROVED/REJECTED → EXPIRED
 */
export type PricelistStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

export type Currency = 'IDR' | 'USD' | 'EUR' | 'SGD' | 'JPY'

export type SortField = 'price' | 'valid_from' | 'valid_to' | 'created_at' | 'updated_at'

export type SortOrder = 'asc' | 'desc'

export type PricelistChangeSource = 'PI_POST' | 'PI_UNPOST' | 'MANUAL'

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

export interface PriceChangeListResponse {
  items: PriceChangeWithRelations[]
  summary: PriceChangeSummary
  pagination: PaginationParams
}

// ============================================================================
// BASE ENTITIES
// ============================================================================

/**
 * Core pricelist entity (matches backend schema)
 */
export interface Pricelist {
  readonly id: string
  readonly company_id: string
  readonly supplier_id: string
  readonly product_id: string
  readonly uom_id: string
  readonly price: number
  readonly currency: Currency
  readonly valid_from: string // ISO date
  readonly valid_to: string | null // ISO date or null for permanent
  readonly status: PricelistStatus
  readonly is_active: boolean
  readonly created_at: string
  readonly updated_at: string
  readonly deleted_at: string | null
}

/**
 * Pricelist with populated relations (for display)
 */
export interface PricelistWithRelations extends Pricelist {
  supplier_name?: string
  product_name?: string
  uom_name?: string
  supplier?: {
    id: string
    supplier_code: string
    supplier_name: string
  }
  product?: {
    id: string
    product_code: string
    product_name: string
  }
  uom?: {
    id: string
    uom_code: string
    uom_name: string
  }
}

// ============================================================================
// DTO TYPES (Data Transfer Objects)
// ============================================================================

/**
 * Create pricelist payload
 * All fields required except optional ones
 */
export interface CreatePricelistDto {
  company_id: string
  supplier_id: string
  product_id: string
  uom_id: string
  price: number
  currency?: Currency // Default: IDR
  valid_from: string // ISO date
  valid_to?: string | null // ISO date or null
  is_active?: boolean // Default: true
}

/**
 * Update pricelist payload
 * Only mutable fields (status DRAFT only)
 */
export interface UpdatePricelistDto {
  price?: number
  currency?: Currency
  valid_from?: string
  valid_to?: string | null
  is_active?: boolean
}

/**
 * Approval action payload
 */
export interface PricelistApprovalDto {
  status: 'APPROVED' | 'REJECTED'
  notes?: string
}

// ============================================================================
// QUERY TYPES
// ============================================================================

/**
 * List query parameters
 */
export interface PricelistListQuery {
  page?: number
  limit?: number
  search?: string
  supplier_id?: string
  product_id?: string
  uom_id?: string
  status?: PricelistStatus
  is_active?: boolean
  valid_on?: string // ISO date - filter by validity
  sort_by?: SortField
  sort_order?: SortOrder
  include_deleted?: boolean // Show deleted items
}

/**
 * Lookup query for PO integration
 * Find active approved pricelist for specific combination
 */
export interface PricelistLookupQuery {
  supplier_id: string
  product_id: string
  uom_id: string
  date?: string // ISO date, default: today
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Pagination metadata
 */
export interface PaginationParams {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * List response
 */
export interface PricelistListResponse {
  data: PricelistWithRelations[]
  pagination: PaginationParams
}

/**
 * Lookup response
 */
export interface PricelistLookupResponse {
  pricelist: PricelistWithRelations | null
  message?: string
}

// ============================================================================
// FORM STATE TYPES
// ============================================================================

/**
 * Form validation errors
 */
export interface PricelistFormErrors {
  supplier_id?: string
  product_id?: string
  uom_id?: string
  price?: string
  currency?: string
  valid_from?: string
  valid_to?: string
  general?: string
}

/**
 * Form state
 */
export interface PricelistFormState {
  data: CreatePricelistDto | UpdatePricelistDto
  errors: PricelistFormErrors
  touched: Record<string, boolean>
  isSubmitting: boolean
  isDirty: boolean
}
