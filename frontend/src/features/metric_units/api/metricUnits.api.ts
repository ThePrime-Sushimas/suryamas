import api from '@/lib/axios'
import type { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number } }

export const metricUnitsApi = {
  list: async (page = 1, limit = 10) => {
    const res = await api.get<PaginatedResponse<MetricUnit>>('/metric-units', { params: { page, limit } })
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
  }
}
