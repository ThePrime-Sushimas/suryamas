import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type {
  GoodsProcessingDetail,
  GoodsProcessingWithRelations,
  UpdateGoodsProcessingDto,
  RejectDto,
  OutputTemplateRow,
} from '../api/goods-processing.types'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GoodsProcessingListParams {
  page?: number
  limit?: number
  status?: string
  branch_id?: string
  date_from?: string
  date_to?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface GoodsProcessingListResponse {
  data: GoodsProcessingWithRelations[]
  pagination: PaginationMeta
}

// Re-export types for convenience
export type { GoodsProcessingDetail, GoodsProcessingWithRelations, OutputTemplateRow }
export type { UpdateGoodsProcessingDto, RejectDto }

// ── Query Keys ────────────────────────────────────────────────────────────────

export const gpKeys = {
  all:    () => ['goods-processing'] as const,
  lists:  () => [...gpKeys.all(), 'list'] as const,
  list:   (p: GoodsProcessingListParams) => [...gpKeys.lists(), p] as const,
  detail: (id: string) => [...gpKeys.all(), 'detail', id] as const,
  template: (productId: string) => ['product-output-template', productId] as const,
}

// ── List ──────────────────────────────────────────────────────────────────────

export function useGoodsProcessingList(params: GoodsProcessingListParams = {}) {
  return useQuery({
    queryKey: gpKeys.list(params),
    queryFn: async (): Promise<GoodsProcessingListResponse> => {
      const { data } = await api.get('/goods-processing', { params })
      return { data: data.data, pagination: data.pagination }
    },
  })
}

// ── Detail ────────────────────────────────────────────────────────────────────

export function useGoodsProcessingDetail(id: string) {
  return useQuery({
    queryKey: gpKeys.detail(id),
    queryFn: async (): Promise<GoodsProcessingDetail> => {
      const { data } = await api.get(`/goods-processing/${id}`)
      return data.data
    },
    enabled: Boolean(id),
  })
}

// ── Output Template ───────────────────────────────────────────────────────────

export function useProductOutputTemplate(productId: string) {
  return useQuery({
    queryKey: gpKeys.template(productId),
    queryFn: async (): Promise<OutputTemplateRow[]> => {
      const { data } = await api.get(`/products/${productId}/output-template`)
      return data.data
    },
    enabled: Boolean(productId),
  })
}

export interface SaveTemplateDto {
  items: {
    output_product_id: string
    output_uom: string
    suggested_pct?: number | null
    sort_order?: number
    notes?: string | null
  }[]
}

export function useSaveProductOutputTemplate(productId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dto: SaveTemplateDto) => {
      const { data } = await api.put(`/products/${productId}/output-template`, dto)
      return data.data as OutputTemplateRow[]
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gpKeys.template(productId) })
    },
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useStartGoodsProcessing(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/goods-processing/${id}/start`)
      return data.data as GoodsProcessingDetail
    },
    onSuccess: (data) => {
      qc.setQueryData(gpKeys.detail(id), data)
      qc.invalidateQueries({ queryKey: gpKeys.lists() })
    },
  })
}

export function useUpdateGoodsProcessing(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dto: UpdateGoodsProcessingDto) => {
      const { data } = await api.put(`/goods-processing/${id}`, dto)
      return data.data as GoodsProcessingDetail
    },
    onSuccess: (data) => {
      qc.setQueryData(gpKeys.detail(id), data)
      qc.invalidateQueries({ queryKey: gpKeys.lists() })
    },
  })
}

export function useConfirmGoodsProcessing(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/goods-processing/${id}/confirm`)
      return data.data as GoodsProcessingDetail
    },
    onSuccess: (data) => {
      qc.setQueryData(gpKeys.detail(id), data)
      qc.invalidateQueries({ queryKey: gpKeys.lists() })
    },
  })
}

export function useRejectGoodsProcessing(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dto: RejectDto) => {
      const { data } = await api.post(`/goods-processing/${id}/reject`, dto)
      return data.data as GoodsProcessingDetail
    },
    onSuccess: (data) => {
      qc.setQueryData(gpKeys.detail(id), data)
      qc.invalidateQueries({ queryKey: gpKeys.lists() })
    },
  })
}

export function useBulkConfirmGoodsProcessing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await api.post('/goods-processing/bulk-confirm', { ids })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: gpKeys.lists() })
    },
  })
}

export function useResolveReturn(gpId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ outputId, resolution }: { outputId: string; resolution: 'STOCK' | 'DISCARD' }) => {
      const { data } = await api.post(`/goods-processing/${gpId}/outputs/${outputId}/resolve-return`, { resolution })
      return data.data as GoodsProcessingDetail
    },
    onSuccess: (data) => {
      qc.setQueryData(gpKeys.detail(gpId), data)
      qc.invalidateQueries({ queryKey: gpKeys.lists() })
    },
  })
}

export interface OutputPayload {
  id?: string
  product_id: string
  product_name?: string
  product_code?: string
  qty_output: number
  uom: string
  is_waste: boolean
  waste_reason: string | null
  condition_status: string | null
  actual_qty: number | null
  actual_uom: string | null
  flagged_for_return: boolean
  return_reason: string | null
  sort_order: number
  stock_movement_id?: string | null
}

export function useConfirmGoodsProcessingInput(gpId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { inputId: string; outputs: OutputPayload[] }) =>
      api.patch(`/goods-processing/${gpId}/inputs/${payload.inputId}/confirm`, {
        outputs: payload.outputs,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-processing', gpId] })
    },
  })
}