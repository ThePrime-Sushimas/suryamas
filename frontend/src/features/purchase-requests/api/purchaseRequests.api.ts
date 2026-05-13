import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface PurchaseRequestLine {
  id?: string
  product_id: string
  product_code?: string
  product_name?: string
  qty: number
  qty_approved?: number | null
  qty_ordered?: number
  qty_received?: number
  uom: string
  estimated_price: number | null
  supplier_id: string | null
  supplier_name?: string | null
  notes: string | null
}

export interface PurchaseRequest {
  id: string
  company_id: string
  branch_id: string
  request_number: string
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'CANCELLED'
  request_date: string
  needed_by_date: string | null
  notes: string | null
  requested_by_name: string | null
  approved_by_name: string | null
  approved_at: string | null
  rejected_reason: string | null
  branch_name: string
  branch_code: string
  line_count: number
  total_estimated: number
  created_at: string
  lines?: PurchaseRequestLine[]
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }

const KEYS = {
  list: (params: Record<string, unknown>) => ['purchase-requests', params] as const,
  detail: (id: string) => ['purchase-requests', id] as const,
}

export const usePurchaseRequests = (params: { page?: number; limit?: number; status?: string; branch_id?: string; date_from?: string; date_to?: string; search?: string }) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.status) queryParams.status = params.status
      if (params.branch_id) queryParams.branch_id = params.branch_id
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      if (params.search) queryParams.q = params.search
      const { data } = await api.get('/purchase-requests', { params: queryParams })
      return { data: data.data as PurchaseRequest[], pagination: data.pagination as Pagination }
    },
    staleTime: 30_000,
  })

export const usePurchaseRequest = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/purchase-requests/${id}`)
      return data.data as PurchaseRequest
    },
    enabled: !!id,
  })

export const useCreatePurchaseRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { branch_id: string; needed_by_date?: string | null; notes?: string | null; lines: { product_id: string; qty: number; uom: string; estimated_price?: number | null; supplier_id?: string | null }[] }) => {
      const { data } = await api.post('/purchase-requests', body)
      return data.data as PurchaseRequest
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-requests'] }),
  })
}

export const useUpdatePurchaseRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; needed_by_date?: string | null; notes?: string | null; lines?: { product_id: string; qty: number; uom: string; estimated_price?: number | null; supplier_id?: string | null }[] }) => {
      const { data } = await api.put(`/purchase-requests/${id}`, body)
      return data.data as PurchaseRequest
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-requests'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
    },
  })
}

export const useSubmitPurchaseRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.post(`/purchase-requests/${id}/submit`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-requests'] }),
  })
}

export const useApprovePurchaseRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.post(`/purchase-requests/${id}/approve`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-requests'] }),
  })
}

export const useRejectPurchaseRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rejected_reason }: { id: string; rejected_reason: string }) => {
      await api.post(`/purchase-requests/${id}/reject`, { rejected_reason })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-requests'] }),
  })
}

export const useCancelPurchaseRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.post(`/purchase-requests/${id}/cancel`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-requests'] }),
  })
}

export const useDeletePurchaseRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/purchase-requests/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-requests'] }),
  })
}
