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

interface ListParams {
  page: number
  limit: number
  sort?: string
  order?: 'asc' | 'desc'
  [key: string]: any
}

const handleApiCall = async <T>(
  apiCall: () => Promise<T>,
  errorMessage = 'Operation failed'
): Promise<T> => {
  try {
    return await apiCall()
  } catch (error: unknown) {
    const message = error.response?.data?.error || errorMessage
    throw new Error(message)
  }
}

const validatePagination = (page: number, limit: number) => {
  if (page < 1) throw new Error('Page must be >= 1')
  if (limit < 1 || limit > 100) throw new Error('Limit must be 1-100')
}

let searchController: AbortController | null = null

export const metricUnitsApi = {
  list: async (page = 1, limit = 25, sort?: SortParams | null, filter?: FilterParams | null) => {
    return handleApiCall(async () => {
      validatePagination(page, limit)
      
      if (searchController) {
        searchController.abort()
      }
      searchController = new AbortController()
      
      const params: ListParams = { page, limit }
      if (sort) {
        params.sort = sort.field
        params.order = sort.order
      }
      if (filter) {
        Object.assign(params, filter)
      }
      
      const res = await api.get<PaginatedResponse<MetricUnit>>('/metric-units', { 
        params,
        signal: searchController.signal 
      })
      return res.data
    }, 'Failed to fetch metric units')
  },

  listActive: async (page = 1, limit = 25) => {
    return handleApiCall(async () => {
      validatePagination(page, limit)
      const res = await api.get<PaginatedResponse<MetricUnit>>('/metric-units/active', { params: { page, limit } })
      return res.data
    }, 'Failed to fetch active metric units')
  },

  getById: async (id: string) => {
    return handleApiCall(async () => {
      const res = await api.get<ApiResponse<MetricUnit>>(`/metric-units/${id}`)
      return res.data.data
    }, 'Failed to fetch metric unit')
  },

  create: async (data: CreateMetricUnitDto) => {
    return handleApiCall(async () => {
      const res = await api.post<ApiResponse<MetricUnit>>('/metric-units', data)
      return res.data.data
    }, 'Failed to create metric unit')
  },

  update: async (id: string, data: UpdateMetricUnitDto) => {
    return handleApiCall(async () => {
      const res = await api.put<ApiResponse<MetricUnit>>(`/metric-units/${id}`, data)
      return res.data.data
    }, 'Failed to update metric unit')
  },

  delete: async (id: string) => {
    return handleApiCall(async () => {
      await api.delete(`/metric-units/${id}`)
    }, 'Failed to delete metric unit')
  },

  restore: async (id: string) => {
    return handleApiCall(async () => {
      const res = await api.post<ApiResponse<MetricUnit>>(`/metric-units/${id}/restore`)
      return res.data.data
    }, 'Failed to restore metric unit')
  },

  bulkUpdateStatus: async (ids: string[], is_active: boolean) => {
    return handleApiCall(async () => {
      await api.post('/metric-units/bulk/status', { ids, is_active })
    }, 'Failed to update status')
  },

  getFilterOptions: async () => {
    return handleApiCall(async () => {
      const res = await api.get<ApiResponse<FilterOptions>>('/metric-units/filter-options')
      return res.data.data
    }, 'Failed to fetch filter options')
  }
}
