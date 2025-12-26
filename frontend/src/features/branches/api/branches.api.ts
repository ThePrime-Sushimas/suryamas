import api from '@/lib/axios'
import type { Branch, CreateBranchDto, UpdateBranchDto, BranchSort, BranchFilter } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number } }

export const branchesApi = {
  list: async (page: number, limit: number, sort?: BranchSort | null, filter?: BranchFilter | null) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))

    if (sort?.field && sort?.order) {
      params.append('sort', sort.field)
      params.append('order', sort.order)
    }

    if (filter?.search) params.append('q', filter.search)
    if (filter?.status) params.append('status', filter.status)
    if (filter?.city) params.append('city', filter.city)

    const res = await api.get<PaginatedResponse<Branch>>(`/branches?${params}`)
    return res.data
  },

  search: async (q: string, page: number, limit: number, sort?: BranchSort | null) => {
    const params = new URLSearchParams()
    params.append('q', q)
    params.append('page', String(page))
    params.append('limit', String(limit))

    if (sort?.field && sort?.order) {
      params.append('sort', sort.field)
      params.append('order', sort.order)
    }

    const res = await api.get<PaginatedResponse<Branch>>(`/branches/search?${params}`)
    return res.data
  },

  getById: async (id: string) => {
    const res = await api.get<ApiResponse<Branch>>(`/branches/${id}`)
    return res.data.data
  },

  create: async (data: CreateBranchDto) => {
    const res = await api.post<ApiResponse<Branch>>('/branches', data)
    return res.data.data
  },

  update: async (id: string, data: UpdateBranchDto) => {
    const res = await api.put<ApiResponse<Branch>>(`/branches/${id}`, data)
    return res.data.data
  },

  delete: async (id: string) => {
    await api.delete(`/branches/${id}`)
  },

  bulkDelete: async (ids: string[]) => {
    await api.post('/branches/bulk/delete', { ids })
  }
}
