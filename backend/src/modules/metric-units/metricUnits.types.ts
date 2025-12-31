import { MetricType } from './metricUnits.constants'

export type { MetricType }

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

export interface UpdateMetricUnitDto {
  metric_type?: MetricType
  unit_name?: string
  notes?: string | null
  is_active?: boolean
  updated_by?: string | null
}
