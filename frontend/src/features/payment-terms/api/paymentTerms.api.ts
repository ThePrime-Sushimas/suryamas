import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { PaymentTerm, CreatePaymentTermDto, UpdatePaymentTermDto, SortParams, FilterParams, PaginationParams, MinimalPaymentTerm } from '../types'

interface ApiResponse<T> { success: boolean; data: T }
interface PaginatedResponse<T> { success: boolean; data: T[]; pagination: PaginationParams }

// ── React Query Hooks ──

export const usePaymentTerms = (params: { page?: number; limit?: number; sort?: SortParams | null; filter?: FilterParams | null; includeDeleted?: boolean }) =>
  useQuery({
    queryKey: ['payment-terms', params],
    queryFn: async () => {
      const qp: Record<string, string | number | boolean> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.sort) { qp.sort = params.sort.field; qp.order = params.sort.order }
      if (params.filter?.calculation_type) qp.calculation_type = params.filter.calculation_type
      if (params.filter?.is_active !== undefined) qp.is_active = params.filter.is_active
      if (params.filter?.q) qp.q = params.filter.q
      if (params.includeDeleted) qp.includeDeleted = true
      const { data } = await api.get<PaginatedResponse<PaymentTerm>>('/payment-terms', { params: qp })
      return { data: data.data, pagination: data.pagination }
    },
    staleTime: 60_000,
  })

export const usePaymentTerm = (id: number) =>
  useQuery({
    queryKey: ['payment-terms', id],
    queryFn: async () => { const { data } = await api.get<ApiResponse<PaymentTerm>>(`/payment-terms/${id}`); return data.data },
    enabled: !!id,
  })

export const useCreatePaymentTerm = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreatePaymentTermDto) => { const { data } = await api.post<ApiResponse<PaymentTerm>>('/payment-terms', body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-terms'] }),
  })
}

export const useUpdatePaymentTerm = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdatePaymentTermDto & { id: number }) => { const { data } = await api.put<ApiResponse<PaymentTerm>>(`/payment-terms/${id}`, body); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-terms'] }),
  })
}

export const useDeletePaymentTerm = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { await api.delete(`/payment-terms/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-terms'] }),
  })
}

export const useRestorePaymentTerm = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => { const { data } = await api.post<ApiResponse<PaymentTerm>>(`/payment-terms/${id}/restore`); return data.data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-terms'] }),
  })
}

// ── Legacy API object (used by SupplierForm, etc.) ──

export const paymentTermsApi = {
  list: async (page = 1, limit = 25, sort?: SortParams | null, filter?: FilterParams | null) => {
    const params: Record<string, string | number | boolean> = { page, limit }
    if (sort) { params.sort = sort.field; params.order = sort.order }
    if (filter) Object.assign(params, filter)
    const res = await api.get<PaginatedResponse<PaymentTerm>>('/payment-terms', { params })
    return res.data
  },
  minimalActive: async () => {
    const res = await api.get<ApiResponse<MinimalPaymentTerm[]>>('/payment-terms/minimal/active')
    return res.data.data
  },
  getById: async (id: number) => { const res = await api.get<ApiResponse<PaymentTerm>>(`/payment-terms/${id}`); return res.data.data },
  create: async (data: CreatePaymentTermDto) => { const res = await api.post<ApiResponse<PaymentTerm>>('/payment-terms', data); return res.data.data },
  update: async (id: number, data: UpdatePaymentTermDto) => { const res = await api.put<ApiResponse<PaymentTerm>>(`/payment-terms/${id}`, data); return res.data.data },
  delete: async (id: number) => { await api.delete(`/payment-terms/${id}`) },
  restore: async (id: number) => { const res = await api.post<ApiResponse<PaymentTerm>>(`/payment-terms/${id}/restore`); return res.data.data },
}
