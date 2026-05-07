import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto, SortParams, FilterParams, FilterOptions, PaginationParams } from '../types'

interface ApiResponse<T> { success: boolean; data: T }
interface PaginatedResponse<T> { success: boolean; data: T[]; pagination: PaginationParams }

// ── React Query Hooks ──

export const useMetricUnits = (params: { page?: number; limit?: number; sort?: SortParams | null; filter?: FilterParams | null }) =>
  useQuery({
    queryKey: ['metric-units', params],
    queryFn: async () => {
      const qp: Record<string, string | number | boolean> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.sort) { qp.sort = params.sort.field; qp.order = params.sort.order }
      if (params.filter?.metric_type) qp.metric_type = params.filter.metric_type
      if (params.filter?.is_active !== undefined) qp.is_active = params.filter.is_active
      if (params.filter?.q) qp.q = params.filter.q
      const { data } = await api.get<PaginatedResponse<MetricUnit>>('/metric-units', { params: qp })
      return { data: data.data, pagination: data.pagination }
    },
    staleTime: 60_000,
  })

export const useMetricUnit = (id: string) =>
  useQuery({
    queryKey: ['metric-units', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<MetricUnit>>(`/metric-units/${id}`)
      return data.data
    },
    enabled: !!id,
  })

export const useMetricUnitFilterOptions = () =>
  useQuery({
    queryKey: ['metric-units', 'filter-options'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<FilterOptions>>('/metric-units/filter-options')
      return data.data
    },
    staleTime: 5 * 60_000,
  })

export const useCreateMetricUnit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateMetricUnitDto) => {
      const { data } = await api.post<ApiResponse<MetricUnit>>('/metric-units', body)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metric-units'] }),
  })
}

export const useUpdateMetricUnit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateMetricUnitDto & { id: string }) => {
      const { data } = await api.put<ApiResponse<MetricUnit>>(`/metric-units/${id}`, body)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metric-units'] }),
  })
}

export const useDeleteMetricUnit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/metric-units/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metric-units'] }),
  })
}

export const useRestoreMetricUnit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<ApiResponse<MetricUnit>>(`/metric-units/${id}/restore`)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metric-units'] }),
  })
}

// ── Legacy API object (used by ProductUomForm) ──

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
  delete: async (id: string) => { await api.delete(`/metric-units/${id}`) },
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
