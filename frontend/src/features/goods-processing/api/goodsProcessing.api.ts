import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface GoodsProcessingOutput {
  id: string
  input_id: string
  product_id: string
  product_code: string
  product_name: string
  qty_output: number
  uom: string
  is_waste: boolean
  waste_reason: string | null
  photo_urls: string[] | null
  unit_cost: number | null
  allocated_cost: number | null
  stock_movement_id: string | null
  sort_order: number
}

export interface GoodsProcessingInput {
  id: string
  goods_processing_id: string
  gr_line_id: string
  product_id: string
  product_code: string
  product_name: string
  requires_processing: boolean
  qty_input: number
  uom: string
  sort_order: number
  outputs: GoodsProcessingOutput[]
}

export interface GoodsProcessing {
  id: string
  company_id: string
  branch_id: string
  warehouse_id: string
  goods_receipt_id: string
  processing_number: string
  processing_date: string
  processing_type: 'PASS_THROUGH' | 'DISASSEMBLY'
  status: 'DRAFT' | 'PROCESSING' | 'QC_REVIEW' | 'CONFIRMED' | 'REJECTED'
  notes: string | null
  rejection_reason: string | null
  total_input_qty: number | null
  total_output_qty: number | null
  total_waste_qty: number | null
  yield_percentage: number | null
  branch_name: string
  branch_code: string
  warehouse_name: string
  gr_number: string
  supplier_name: string
  input_count: number
  created_at: string
}

export interface GoodsProcessingDetail extends GoodsProcessing {
  inputs: GoodsProcessingInput[]
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }

const KEYS = {
  list: (params: Record<string, unknown>) => ['goods-processing', params] as const,
  detail: (id: string) => ['goods-processing', id] as const,
}

export const useGoodsProcessingList = (params: { page?: number; limit?: number; status?: string; branch_id?: string; date_from?: string; date_to?: string }) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.status) queryParams.status = params.status
      if (params.branch_id) queryParams.branch_id = params.branch_id
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      const { data } = await api.get('/goods-processing', { params: queryParams })
      return { data: data.data as GoodsProcessing[], pagination: data.pagination as Pagination }
    },
    staleTime: 30_000,
  })

export const useGoodsProcessingDetail = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/goods-processing/${id}`)
      return data.data as GoodsProcessingDetail
    },
    enabled: !!id,
  })

export const useStartProcessing = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/goods-processing/${id}/start`)
      return data.data as GoodsProcessingDetail
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goods-processing'] }),
  })
}

export const useUpdateProcessing = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: unknown }) => {
      const { data } = await api.put(`/goods-processing/${id}`, body)
      return data.data as GoodsProcessingDetail
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['goods-processing'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
    },
  })
}

export const useSubmitQc = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/goods-processing/${id}/submit-qc`)
      return data.data as GoodsProcessingDetail
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goods-processing'] }),
  })
}

export const useConfirmProcessing = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/goods-processing/${id}/confirm`)
      return data.data as GoodsProcessingDetail
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-processing'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export const useBulkConfirm = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await api.post('/goods-processing/bulk-confirm', { ids })
      return data.data as { success: string[]; failed: { id: string; reason: string }[] }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-processing'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export const useRejectProcessing = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rejection_reason }: { id: string; rejection_reason: string }) => {
      const { data } = await api.post(`/goods-processing/${id}/reject`, { rejection_reason })
      return data.data as GoodsProcessingDetail
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goods-processing'] }),
  })
}
