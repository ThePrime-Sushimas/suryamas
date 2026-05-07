import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Branch, CreateBranchDto, UpdateBranchDto, BranchSort, BranchFilter } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }

// ── React Query Hooks ──

export const useBranches = (params: { page?: number; limit?: number; sort?: BranchSort | null; filter?: BranchFilter | null }) =>
  useQuery({
    queryKey: ['branches', params],
    queryFn: async () => {
      const qp = new URLSearchParams()
      qp.append('page', String(params.page ?? 1))
      qp.append('limit', String(params.limit ?? 10))
      if (params.sort?.field) { qp.append('sort', params.sort.field); qp.append('order', params.sort.order) }
      if (params.filter?.search) qp.append('q', params.filter.search)
      if (params.filter?.status) qp.append('status', params.filter.status)
      if (params.filter?.city) qp.append('city', params.filter.city)
      const { data } = await api.get<PaginatedResponse<Branch>>(`/branches?${qp}`)
      return { data: data.data, pagination: data.pagination }
    },
    staleTime: 60_000,
  })

export const useBranch = (id: string) =>
  useQuery({
    queryKey: ['branches', id],
    queryFn: async () => { const { data } = await api.get<ApiResponse<Branch>>(`/branches/${id}`); return data.data },
    enabled: !!id,
  })

export const useCreateBranch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateBranchDto) => { const { data } = await api.post<ApiResponse<Branch>>('/branches', body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  })
}

export const useUpdateBranch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateBranchDto & { id: string }) => { const { data } = await api.put<ApiResponse<Branch>>(`/branches/${id}`, body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  })
}

export const useDeleteBranch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/branches/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  })
}

export const useCloseBranch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason, closed_date }: { id: string; reason: string; closed_date: string }) => {
      const { data } = await api.post<ApiResponse<Branch>>(`/branches/${id}/close`, { reason, closed_date })
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  })
}

// ── Legacy API object (used by supplier-products, accounting, etc.) ──

export const branchesApi = {
  list: async (page: number, limit: number, sort?: BranchSort | null, filter?: BranchFilter | null) => {
    const params = new URLSearchParams()
    params.append('page', String(page))
    params.append('limit', String(limit))
    if (sort?.field && sort?.order) { params.append('sort', sort.field); params.append('order', sort.order) }
    if (filter?.search) params.append('q', filter.search)
    if (filter?.status) params.append('status', filter.status)
    if (filter?.city) params.append('city', filter.city)
    const res = await api.get<PaginatedResponse<Branch>>(`/branches?${params}`)
    return res.data
  },
  search: async (q: string, page: number, limit: number, sort?: BranchSort | null) => {
    const params = new URLSearchParams()
    params.append('q', q); params.append('page', String(page)); params.append('limit', String(limit))
    if (sort?.field && sort?.order) { params.append('sort', sort.field); params.append('order', sort.order) }
    const res = await api.get<PaginatedResponse<Branch>>(`/branches/search?${params}`)
    return res.data
  },
  getById: async (id: string) => { const res = await api.get<ApiResponse<Branch>>(`/branches/${id}`); return res.data.data },
  create: async (data: CreateBranchDto) => { const res = await api.post<ApiResponse<Branch>>('/branches', data); return res.data.data },
  update: async (id: string, data: UpdateBranchDto) => { const res = await api.put<ApiResponse<Branch>>(`/branches/${id}`, data); return res.data.data },
  delete: async (id: string) => { await api.delete(`/branches/${id}`) },
  bulkDelete: async (ids: string[]) => { await api.post('/branches/bulk/delete', { ids }) },
  closeBranch: async (id: string, reason: string, closedDate: string) => { const res = await api.post(`/branches/${id}/close`, { reason, closed_date: closedDate }); return res.data.data },
}
