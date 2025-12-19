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
  created_by?: string | null
}

export interface UpdateMetricUnitDto extends Partial<CreateMetricUnitDto> {
  updated_by?: string | null
  updated_at?: string
}
