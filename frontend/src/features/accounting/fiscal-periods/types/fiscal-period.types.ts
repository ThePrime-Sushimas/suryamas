export interface FiscalPeriod {
  id: string
  company_id: string
  fiscal_year: number
  period: string
  period_start: string
  period_end: string
  is_open: boolean
  is_adjustment_allowed: boolean
  is_year_end: boolean
  opened_at?: string
  opened_by?: string
  closed_at?: string
  closed_by?: string
  close_reason?: string
  created_at: string
  created_by?: string
  updated_at: string
  updated_by?: string
  deleted_at?: string
  deleted_by?: string
}

export interface FiscalPeriodWithDetails extends FiscalPeriod {
  opened_by_name?: string
  closed_by_name?: string
  created_by_name?: string
  updated_by_name?: string
}

export interface CreateFiscalPeriodDto {
  period: string
  period_start: string
  period_end: string
  is_adjustment_allowed?: boolean
  is_year_end?: boolean
}

export interface UpdateFiscalPeriodDto {
  is_adjustment_allowed?: boolean
}

export interface ClosePeriodDto {
  close_reason?: string
}

export interface FiscalPeriodFilter {
  fiscal_year?: number
  is_open?: boolean
  period?: string
  show_deleted?: boolean
  q?: string
}

export interface FiscalPeriodListResponse {
  data: FiscalPeriodWithDetails[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
