import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface GoodsReceiptLine {
  id?: string
  po_line_id: string
  product_id: string
  product_code?: string
  product_name?: string
  uom?: string
  qty_received: number
  unit_price_invoice: number
  total_price_invoice?: number
  unit_price_po?: number
  price_variance?: number
  price_variance_pct?: number
  variance_status?: 'OK' | 'NOTICE' | 'DISPUTED'
  notes?: string | null
}

export interface GoodsReceipt {
  id: string
  company_id: string
  branch_id: string
  po_id: string
  warehouse_id: string
  gr_number: string
  status: 'DRAFT' | 'CONFIRMED'
  received_date: string
  invoice_number: string | null
  invoice_date: string | null
  invoice_photo_url: string | null
  journal_id: string | null
  notes: string | null
  branch_name: string
  branch_code: string
  po_number: string
  supplier_name: string
  warehouse_name: string
  created_by_name: string | null
  line_count: number
  total_invoice_amount: number
  created_at: string
  lines?: GoodsReceiptLine[]
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }

const KEYS = {
  list: (params: Record<string, unknown>) => ['goods-receipts', params] as const,
  detail: (id: string) => ['goods-receipts', id] as const,
}

export const useGoodsReceipts = (params: { page?: number; limit?: number; status?: string; po_id?: string; branch_id?: string; date_from?: string; date_to?: string }) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.status) queryParams.status = params.status
      if (params.po_id) queryParams.po_id = params.po_id
      if (params.branch_id) queryParams.branch_id = params.branch_id
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      const { data } = await api.get('/goods-receipts', { params: queryParams })
      return { data: data.data as GoodsReceipt[], pagination: data.pagination as Pagination }
    },
    staleTime: 30_000,
  })

export const useGoodsReceipt = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/goods-receipts/${id}`)
      return data.data as GoodsReceipt
    },
    enabled: !!id,
  })

export const useCreateGoodsReceipt = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      po_id: string; warehouse_id: string; received_date?: string;
      invoice_number?: string | null; invoice_date?: string | null; invoice_photo_url?: string | null;
      notes?: string | null;
      lines: { po_line_id: string; product_id: string; qty_received: number; unit_price_invoice: number; notes?: string | null }[]
    }) => {
      const { data } = await api.post('/goods-receipts', body)
      return data.data as GoodsReceipt
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })
}

export const useConfirmGoodsReceipt = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, invoice_photo_url }: { id: string; invoice_photo_url?: string }) => {
      const { data } = await api.post(`/goods-receipts/${id}/confirm`, { invoice_photo_url })
      return data.data as GoodsReceipt
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export const useDeleteGoodsReceipt = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/goods-receipts/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goods-receipts'] }),
  })
}
