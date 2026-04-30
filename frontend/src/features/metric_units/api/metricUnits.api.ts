import api from '@/lib/axios'
import type { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto, SortParams, FilterParams, FilterOptions, PaginationParams } from '../types'

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: PaginationParams
}

export const metricUnitsApi = {
  list: async (page = 1, limit = 25, sort?: SortParams | null, filter?: FilterParams | null) => {
    const params: Record<string, string | number | boolean> = { page, limit }
    if (sort) { params.sort = sort.field; params.order = sort.order }
    if (filter) {
      if (filter.metric_type) params.metric_type = filter.metric_type
      if (filter.is_active !== undefined) params.is_active = filter.is_active
      if (filter.q) params.q = filter.q
    }
    const res = await api.get<PaginatedResponse<MetricUnit>>('/metric-units', { params })
    return res.data
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<MetricUnit>>(`/metric-units/${id}`)
    return res.data.data
  },

  create: async (data: CreateMetricUnitDto) => {
    const res = await api.post<ApiResponse<MetricUnit>>('/metric-units', data)
    return res.data.data
  },

  update: async (id: string, data: UpdateMetricUnitDto) => {
    const res = await api.put<ApiResponse<MetricUnit>>(`/metric-units/${id}`, data)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/metric-units/${id}`)
  },

  restore: async (id: string) => {
    const res = await api.post<ApiResponse<MetricUnit>>(`/metric-units/${id}/restore`)
    return res.data.data
  },

  bulkUpdateStatus: async (ids: string[], is_active: boolean) => {
    await api.post('/metric-units/bulk/status', { ids, is_active })
  },

  getFilterOptions: async () => {
    const res = await api.get<ApiResponse<FilterOptions>>('/metric-units/filter-options')
    return res.data.data
  }
}
