export interface FiscalPeriod {
  id: string
  company_id: string
  fiscal_year: number
  period: string // YYYY-MM (accounting period)
  period_start: string // DATE
  period_end: string // DATE
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

export interface CreateFiscalPeriodDto {
  period: string // YYYY-MM
  period_start: string
  period_end: string
  is_adjustment_allowed?: boolean
  is_year_end?: boolean
}

export interface UpdateFiscalPeriodDto {
  /**
   * Only adjustment flag is mutable.
   * Closed period cannot be modified.
   */
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

export interface SortParams {
  field: 'period' | 'fiscal_year' | 'is_open' | 'created_at' | 'updated_at'
  order: 'asc' | 'desc'
}
