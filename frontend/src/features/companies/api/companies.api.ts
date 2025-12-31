import api from '@/lib/axios'
import type { Company, CreateCompanyDto, UpdateCompanyDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number } }

export const companiesApi = {
  list: async (page: number, limit: number, sort?: { field: string; order: string }, filter?: Record<string, unknown>) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))
    if (sort?.field && sort?.order) {
      params.append('sort.field', sort.field)
      params.append('sort.order', sort.order)
    }
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        params.append(key, String(value))
      })
    }
    const res = await api.get<PaginatedResponse<Company>>(`/companies?${params}`)
    return res.data
  },

  search: async (q: string, page: number, limit: number, filter?: Record<string, unknown>) => {
    const params = new URLSearchParams()
    params.append('q', q)
    params.append('page', String(page))
    params.append('limit', String(limit))
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return
        params.append(key, String(value))
      })
    }
    const res = await api.get<PaginatedResponse<Company>>(`/companies/search?${params}`)
    return res.data
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<Company>>(`/companies/${id}`)
    return res.data.data
  },

  create: async (data: CreateCompanyDto) => {
    const res = await api.post<ApiResponse<Company>>('/companies', data)
    return res.data.data
  },

  update: async (id: string, data: UpdateCompanyDto) => {
    const res = await api.put<ApiResponse<Company>>(`/companies/${id}`, data)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/companies/${id}`)
  },

  bulkDelete: async (ids: string[]) => {
    await api.post('/companies/bulk/delete', { ids })
  }
}
