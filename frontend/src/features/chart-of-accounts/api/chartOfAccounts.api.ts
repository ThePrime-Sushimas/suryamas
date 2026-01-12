import api from '@/lib/axios'
import type { ChartOfAccount, ChartOfAccountTreeNode, CreateChartOfAccountDto, UpdateChartOfAccountDto, ChartOfAccountFilter } from '../types/chart-of-account.types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number } }

// Helper function to append filter parameters
const appendFilterParams = (params: URLSearchParams, filter?: ChartOfAccountFilter) => {
  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      params.append(key, String(value))
    })
  }
}

export const chartOfAccountsApi = {
  list: async (companyId: string, page: number, limit: number, sort?: { field: string; order: string }, filter?: ChartOfAccountFilter) => {
    const params = new URLSearchParams()
    params.append('company_id', companyId)
    params.append('page', String(page))
    params.append('limit', String(limit))
    if (sort?.field && sort?.order) {
      params.append('sort.field', sort.field)
      params.append('sort.order', sort.order)
    }
    appendFilterParams(params, filter)
    const res = await api.get<PaginatedResponse<ChartOfAccount>>(`/chart-of-accounts?${params}`)
    return res.data
  },

  search: async (companyId: string, q: string, page: number, limit: number, filter?: ChartOfAccountFilter) => {
    const params = new URLSearchParams()
    params.append('company_id', companyId)
    params.append('q', q)
    params.append('page', String(page))
    params.append('limit', String(limit))
    params.append('sort.field', 'level')
    params.append('sort.order', 'asc')
    appendFilterParams(params, filter)
    const res = await api.get<PaginatedResponse<ChartOfAccount>>(`/chart-of-accounts/search?${params}`)
    return res.data
  },

  getTree: async (companyId: string, maxDepth?: number) => {
    const params = new URLSearchParams()
    params.append('company_id', companyId)
    if (maxDepth !== undefined) params.append('maxDepth', String(maxDepth))
    const res = await api.get<ApiResponse<ChartOfAccountTreeNode[]>>(`/chart-of-accounts/tree?${params}`)
    return res.data.data
  },

  getById: async (companyId: string, id: string) => {
    const params = new URLSearchParams()
    params.append('company_id', companyId)
    const res = await api.get<ApiResponse<ChartOfAccount>>(`/chart-of-accounts/${id}?${params}`)
    return res.data.data
  },

  create: async (data: CreateChartOfAccountDto) => {
    const res = await api.post<ApiResponse<ChartOfAccount>>('/chart-of-accounts', data)
    return res.data.data
  },

  update: async (companyId: string, id: string, data: UpdateChartOfAccountDto) => {
    const params = new URLSearchParams()
    params.append('company_id', companyId)
    const res = await api.put<ApiResponse<ChartOfAccount>>(`/chart-of-accounts/${id}?${params}`, data)
    return res.data.data
  },

  delete: async (companyId: string, id: string) => {
    const params = new URLSearchParams()
    params.append('company_id', companyId)
    await api.delete(`/chart-of-accounts/${id}?${params}`)
  },

  bulkDelete: async (companyId: string, ids: string[]) => {
    const params = new URLSearchParams()
    params.append('company_id', companyId)
    await api.post(`/chart-of-accounts/bulk/delete?${params}`, { ids })
  },

  bulkUpdateStatus: async (companyId: string, ids: string[], is_active: boolean) => {
    const params = new URLSearchParams()
    params.append('company_id', companyId)
    await api.post(`/chart-of-accounts/bulk/status?${params}`, { ids, is_active })
  },

  export: async (format: 'csv' | 'excel' = 'csv') => {
    const res = await api.get(`/chart-of-accounts/export/${format}`, { responseType: 'blob' })
    return res.data
  },

  import: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<ApiResponse<{ imported: number; errors: string[] }>>('/chart-of-accounts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data.data
  }
}