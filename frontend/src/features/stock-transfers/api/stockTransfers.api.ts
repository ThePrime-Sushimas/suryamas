import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type TransferType = 'TRANSFER' | 'LOAN'
export type TransferStatus = 'DRAFT' | 'CONFIRMED' | 'RETURNED' | 'CANCELLED'

export interface StockTransferLine {
  id: string
  stock_transfer_id: string
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  qty: number
  cost_per_unit: number
  notes: string | null
  sort_order: number
  out_movement_id: string | null
  in_movement_id: string | null
  return_out_movement_id: string | null
  return_in_movement_id: string | null
}

export interface StockTransfer {
  id: string
  company_id: string
  transfer_number: string
  transfer_type: TransferType
  status: TransferStatus
  source_warehouse_id: string
  source_warehouse_name: string
  target_warehouse_id: string
  target_warehouse_name: string
  source_branch_id: string
  source_branch_name: string
  target_branch_id: string
  target_branch_name: string
  transfer_date: string
  notes: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  confirmed_by_name: string | null
  returned_at: string | null
  returned_by: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  line_count: number
  created_at: string
  lines?: StockTransferLine[]
}

// ─── KEYS ────────────────────────────────────────────────────────────────────

const KEYS = {
  list: (p: Record<string, unknown>) => ['stock-transfers', p] as const,
  detail: (id: string) => ['stock-transfers', id] as const,
}

// ─── LIST ────────────────────────────────────────────────────────────────────

export const useStockTransfers = (params: {
  page?: number; limit?: number
  transfer_type?: TransferType | ''
  status?: TransferStatus | ''
  source_branch_id?: string
  target_branch_id?: string
  date_from?: string; date_to?: string
  search?: string
} = {}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.transfer_type) queryParams.transfer_type = params.transfer_type
      if (params.status) queryParams.status = params.status
      if (params.source_branch_id) queryParams.source_branch_id = params.source_branch_id
      if (params.target_branch_id) queryParams.target_branch_id = params.target_branch_id
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      if (params.search) queryParams.search = params.search

      const { data } = await api.get('/stock-transfers', { params: queryParams })
      return { data: data.data as StockTransfer[], pagination: data.pagination }
    },
    staleTime: 30_000,
  })

// ─── DETAIL ──────────────────────────────────────────────────────────────────

export const useStockTransfer = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/stock-transfers/${id}`)
      return data.data as StockTransfer
    },
    enabled: !!id,
  })

// ─── CREATE ──────────────────────────────────────────────────────────────────

export const useCreateStockTransfer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      transfer_type?: TransferType
      source_warehouse_id: string
      target_warehouse_id: string
      transfer_date: string
      notes?: string | null
      lines: { product_id: string; qty: number; notes?: string | null }[]
    }) => {
      const { data } = await api.post('/stock-transfers', body)
      return data.data as StockTransfer
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-transfers'] }),
  })
}

// ─── CONFIRM ─────────────────────────────────────────────────────────────────

export const useConfirmStockTransfer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/stock-transfers/${id}/confirm`)
      return data.data as StockTransfer
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-transfers'] }),
  })
}

// ─── RETURN LOAN ─────────────────────────────────────────────────────────────

export const useReturnLoan = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/stock-transfers/${id}/return`)
      return data.data as StockTransfer
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-transfers'] }),
  })
}

// ─── CANCEL ──────────────────────────────────────────────────────────────────

export const useCancelStockTransfer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, cancel_reason }: { id: string; cancel_reason?: string }) => {
      const { data } = await api.post(`/stock-transfers/${id}/cancel`, { cancel_reason })
      return data.data as StockTransfer
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-transfers'] }),
  })
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export const useDeleteStockTransfer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/stock-transfers/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-transfers'] }),
  })
}
