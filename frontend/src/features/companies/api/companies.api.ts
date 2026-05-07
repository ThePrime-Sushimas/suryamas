import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Company, CreateCompanyDto, UpdateCompanyDto } from '../types'

type ApiResponse<T> = { success: boolean; data: T }
type PaginatedResponse<T> = ApiResponse<T[]> & { pagination: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }

// ── React Query Hooks ──

export const useCompanies = (params: { page?: number; limit?: number; search?: string; status?: string; company_type?: string }) =>
  useQuery({
    queryKey: ['companies', params],
    queryFn: async () => {
      const qp = new URLSearchParams()
      qp.append('page', String(params.page ?? 1))
      qp.append('limit', String(params.limit ?? 10))
      if (params.status) qp.append('status', params.status)
      if (params.company_type) qp.append('company_type', params.company_type)
      const endpoint = params.search ? `/companies/search?q=${encodeURIComponent(params.search)}&${qp}` : `/companies?${qp}`
      const { data } = await api.get<PaginatedResponse<Company>>(endpoint)
      return { data: data.data, pagination: data.pagination }
    },
    staleTime: 60_000,
  })

export const useCompany = (id: string) =>
  useQuery({
    queryKey: ['companies', id],
    queryFn: async () => { const { data } = await api.get<ApiResponse<Company>>(`/companies/${id}`); return data.data },
    enabled: !!id,
  })

export const useCreateCompany = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateCompanyDto) => { const { data } = await api.post<ApiResponse<Company>>('/companies', body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export const useUpdateCompany = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateCompanyDto & { id: string }) => { const { data } = await api.put<ApiResponse<Company>>(`/companies/${id}`, body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export const useDeleteCompany = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/companies/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

// ── Legacy API object (used by BranchForm, ChartOfAccountsPage) ──

export const companiesApi = {
  list: async (page: number, limit: number, sort?: { field: string; order: string }, filter?: Record<string, unknown>) => {
    const params = new URLSearchParams()
    params.append('page', String(page)); params.append('limit', String(limit))
    if (sort?.field && sort?.order) { params.append('sort.field', sort.field); params.append('sort.order', sort.order) }
    if (filter) Object.entries(filter).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.append(k, String(v)) })
    const res = await api.get<PaginatedResponse<Company>>(`/companies?${params}`)
    return res.data
  },
  search: async (q: string, page: number, limit: number, filter?: Record<string, unknown>) => {
    const params = new URLSearchParams()
    params.append('q', q); params.append('page', String(page)); params.append('limit', String(limit))
    if (filter) Object.entries(filter).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.append(k, String(v)) })
    const res = await api.get<PaginatedResponse<Company>>(`/companies/search?${params}`)
    return res.data
  },
  getById: async (id: string) => { const res = await api.get<ApiResponse<Company>>(`/companies/${id}`); return res.data.data },
  create: async (data: CreateCompanyDto) => { const res = await api.post<ApiResponse<Company>>('/companies', data); return res.data.data },
  update: async (id: string, data: UpdateCompanyDto) => { const res = await api.put<ApiResponse<Company>>(`/companies/${id}`, data); return res.data.data },
  delete: async (id: string) => { await api.delete(`/companies/${id}`) },
  bulkDelete: async (ids: string[]) => { await api.post('/companies/bulk/delete', { ids }) },
}
