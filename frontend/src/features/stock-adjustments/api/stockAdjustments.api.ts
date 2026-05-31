import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export type AdjustmentType = 'WASTE' | 'BREAKDOWN'
export type AdjustmentStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
export type AdjustmentReason = 'EXPIRED' | 'DAMAGED' | 'CONTAMINATED' | 'OVERSTOCK' | 'PROCESSING_LOSS' | 'OTHER'

export interface StockAdjustmentLine {
  id: string
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  qty: number
  cost_per_unit: number
  movement_id: string | null
  notes: string | null
}

export interface StockAdjustmentOutput {
  id: string
  product_id: string
  product_code: string
  product_name: string
  base_unit_name: string | null
  qty: number
  cost_per_unit: number
  movement_id: string | null
  notes: string | null
}

export interface StockAdjustment {
  id: string
  company_id: string
  branch_id: string
  branch_name: string
  warehouse_id: string
  warehouse_name: string
  adjustment_number: string
  adjustment_type: AdjustmentType
  status: AdjustmentStatus
  adjustment_date: string
  reason: AdjustmentReason | null
  notes: string | null
  // BREAKDOWN
  input_product_id: string | null
  input_product_code: string | null
  input_product_name: string | null
  input_base_unit_name: string | null
  input_qty: number | null
  input_cost_per_unit: number
  waste_qty: number
  journal_id: string | null
  confirmed_at: string | null
  confirmed_by_name: string | null
  line_count: number
  output_count: number
  created_at: string
  // Detail
  lines?: StockAdjustmentLine[]
  outputs?: StockAdjustmentOutput[]
}

const KEYS = {
  list: (p: Record<string, unknown>) => ['stock-adjustments', p] as const,
  detail: (id: string) => ['stock-adjustments', id] as const,
}

export const useStockAdjustments = (params: {
  page?: number; limit?: number
  adjustment_type?: AdjustmentType | ''
  status?: AdjustmentStatus | ''
  branch_id?: string
  date_from?: string; date_to?: string
  search?: string
} = {}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.adjustment_type) queryParams.adjustment_type = params.adjustment_type
      if (params.status) queryParams.status = params.status
      if (params.branch_id) queryParams.branch_id = params.branch_id
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      if (params.search) queryParams.search = params.search
      const { data } = await api.get('/stock-adjustments', { params: queryParams })
      return { data: data.data as StockAdjustment[], pagination: data.pagination }
    },
    staleTime: 30_000,
  })

export const useStockAdjustment = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/stock-adjustments/${id}`)
      return data.data as StockAdjustment
    },
    enabled: !!id,
  })

export const useCreateStockAdjustment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      adjustment_type: AdjustmentType
      warehouse_id: string
      adjustment_date: string
      reason?: AdjustmentReason | null
      notes?: string | null
      // WASTE
      lines?: { product_id: string; qty: number; notes?: string | null }[]
      // BREAKDOWN
      input_product_id?: string
      input_qty?: number
      outputs?: { product_id: string; qty: number; notes?: string | null }[]
    }) => {
      const { data } = await api.post('/stock-adjustments', body)
      return data.data as StockAdjustment
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-adjustments'] }),
  })
}

export const useConfirmStockAdjustment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/stock-adjustments/${id}/confirm`)
      return data.data as StockAdjustment
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-adjustments'] }),
  })
}

export const useCancelStockAdjustment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/stock-adjustments/${id}/cancel`)
      return data.data as StockAdjustment
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-adjustments'] }),
  })
}

export const useDeleteStockAdjustment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/stock-adjustments/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-adjustments'] }),
  })
}
