export type MetricType = 'Unit' | 'Volume' | 'Weight'

export interface MetricUnit {
  id: string
  metric_type: MetricType
  unit_name: string
  notes?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
}

export interface CreateMetricUnitDto {
  metric_type: MetricType
  unit_name: string
  notes?: string | null
  is_active?: boolean
}

export type UpdateMetricUnitDto = Partial<CreateMetricUnitDto>

export interface PaginationParams {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface SortParams {
  field: string
  order: 'asc' | 'desc'
}

export interface FilterParams {
  metric_type?: MetricType
  is_active?: boolean
  q?: string
}

export interface FilterOptions {
  metric_types: MetricType[]
  statuses: Array<{ label: string; value: boolean }>
}
