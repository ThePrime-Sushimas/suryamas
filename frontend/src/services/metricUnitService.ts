import api from '@/lib/axios'
import type { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto } from '@/types/metricUnit'
import type { ApiResponse } from '@/types'

interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const metricUnitService = {
  list: async (
    page: number = 1,
    limit: number = 10,
    sort?: { field: string; order: 'asc' | 'desc' },
    filter?: any
  ): Promise<PaginatedResponse<MetricUnit>> => {
    const params: any = { page, limit }
    if (sort) {
      params['sort.field'] = sort.field
      params['sort.order'] = sort.order
    }
    if (filter?.metric_type) params['filter[metric_type]'] = filter.metric_type
    if (filter?.is_active !== undefined) params['filter[is_active]'] = filter.is_active
    if (filter?.q) params['filter[q]'] = filter.q

    const { data } = await api.get<any>('/metric-units', { params })
    return { data: data.data, pagination: data.pagination }
  },

  listActive: async (
    page: number = 1,
    limit: number = 10,
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<PaginatedResponse<MetricUnit>> => {
    const params: any = { page, limit }
    if (sort) {
      params['sort.field'] = sort.field
      params['sort.order'] = sort.order
    }

    const { data } = await api.get<any>('/metric-units/active', { params })
    return { data: data.data, pagination: data.pagination }
  },

  getById: async (id: string): Promise<MetricUnit> => {
    const { data } = await api.get<ApiResponse<MetricUnit>>(`/metric-units/${id}`)
    return data.data
  },

  create: async (dto: CreateMetricUnitDto): Promise<MetricUnit> => {
    const { data } = await api.post<ApiResponse<MetricUnit>>('/metric-units', dto)
    return data.data
  },

  update: async (id: string, dto: UpdateMetricUnitDto): Promise<MetricUnit> => {
    const { data } = await api.put<ApiResponse<MetricUnit>>(`/metric-units/${id}`, dto)
    return data.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/metric-units/${id}`)
  },

  bulkUpdateStatus: async (ids: string[], is_active: boolean): Promise<void> => {
    await api.post('/metric-units/bulk/status', { ids, is_active })
  },

  filterOptions: async (): Promise<{ metric_types: string[]; statuses: boolean[] }> => {
    const { data } = await api.get<any>('/metric-units/filter-options')
    return data.data
  }
}
