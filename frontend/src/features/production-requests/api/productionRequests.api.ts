import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type ProductionRequestStatus = 'DRAFT' | 'ACCEPTED' | 'RECEIVED' | 'CANCELLED'

export interface ProductionRequestLine {
  id: string
  production_request_id: string
  wip_id: string
  wip_code: string
  wip_name: string
  yield_qty: number
  uom: string
  qty_batch: number
  qty_batch_approved: number | null
  notes: string | null
  sort_order: number
}

export interface ProductionRequest {
  id: string
  company_id: string
  request_number: string
  status: ProductionRequestStatus
  requesting_branch_id: string
  requesting_branch_name: string
  fulfilling_branch_id: string
  fulfilling_branch_name: string
  request_date: string
  notes: string | null
  accepted_at: string | null
  accepted_by: string | null
  accepted_by_name: string | null
  accept_notes: string | null
  received_at: string | null
  received_by: string | null
  received_by_name: string | null
  receive_notes: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  stock_transfer_id: string | null
  stock_transfer_number: string | null
  created_by_name: string | null
  line_count: number
  created_at: string
  lines?: ProductionRequestLine[]
}

// ─── KEYS ────────────────────────────────────────────────────────────────────

const KEYS = {
  list: (p: Record<string, unknown>) => ['production-requests', p] as const,
  detail: (id: string) => ['production-requests', id] as const,
}

// ─── LIST ────────────────────────────────────────────────────────────────────

export const useProductionRequests = (params: {
  page?: number; limit?: number
  status?: ProductionRequestStatus | ''
  requesting_branch_id?: string
  fulfilling_branch_id?: string
  date_from?: string; date_to?: string
  search?: string
} = {}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.status) queryParams.status = params.status
      if (params.requesting_branch_id) queryParams.requesting_branch_id = params.requesting_branch_id
      if (params.fulfilling_branch_id) queryParams.fulfilling_branch_id = params.fulfilling_branch_id
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      if (params.search) queryParams.search = params.search

      const { data } = await api.get('/production-requests', { params: queryParams })
      return { data: data.data as ProductionRequest[], pagination: data.pagination }
    },
    staleTime: 30_000,
  })

// ─── DETAIL ──────────────────────────────────────────────────────────────────

export const useProductionRequest = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/production-requests/${id}`)
      return data.data as ProductionRequest
    },
    enabled: !!id,
  })

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const useCreateProductionRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      requesting_branch_id: string
      fulfilling_branch_id: string
      request_date: string
      notes?: string | null
      lines: { wip_id: string; qty_batch: number; notes?: string | null }[]
    }) => {
      const { data } = await api.post('/production-requests', body)
      return data.data as ProductionRequest
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production-requests'] }),
  })
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export const useUpdateProductionRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string
      fulfilling_branch_id?: string
      request_date?: string
      notes?: string | null
      lines?: { wip_id: string; qty_batch: number; notes?: string | null }[]
    }) => {
      const { data } = await api.put(`/production-requests/${id}`, body)
      return data.data as ProductionRequest
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production-requests'] }),
  })
}

// ─── ACCEPT ──────────────────────────────────────────────────────────────────

export const useAcceptProductionRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string
      accept_notes?: string | null
      lines?: { id: string; qty_batch_approved: number }[]
    }) => {
      const { data } = await api.post(`/production-requests/${id}/accept`, body)
      return data.data as ProductionRequest
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production-requests'] }),
  })
}

// ─── RECEIVE ─────────────────────────────────────────────────────────────────

export const useReceiveProductionRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; receive_notes?: string | null }) => {
      const { data } = await api.post(`/production-requests/${id}/receive`, body)
      return data.data as ProductionRequest
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production-requests'] }),
  })
}

// ─── CANCEL ──────────────────────────────────────────────────────────────────

export const useCancelProductionRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, cancel_reason }: { id: string; cancel_reason?: string }) => {
      const { data } = await api.post(`/production-requests/${id}/cancel`, { cancel_reason })
      return data.data as ProductionRequest
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production-requests'] }),
  })
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export const useDeleteProductionRequest = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/production-requests/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['production-requests'] }),
  })
}

// ─── PRINT ───────────────────────────────────────────────────────────────────

export const usePrintProductionRequest = () =>
  useMutation({
    mutationFn: async (payload: { prId: string; printer_id: string }) => {
      await api.post(`/printers/print/production-request/${payload.prId}`, {
        printer_id: payload.printer_id,
      })
    },
  })
