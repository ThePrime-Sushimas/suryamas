import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface GoodsReceiptLine {
  id?: string
  po_line_id: string
  product_id: string
  product_code?: string
  product_name?: string
  uom?: string
  qty_po_uom?: number
  uom_po?: string
  qty_received: number
  uom_received?: string
  conversion_factor?: number
  qty_rejected?: number
  reject_reason?: string | null
  unit_price_invoice: number
  total_price_invoice?: number
  unit_price_po?: number
  unit_price_po_operational?: number
  unit_price_invoice_operational?: number
  qty_po_operational?: number
  price_variance?: number
  price_variance_pct?: number
  variance_status?: 'OK' | 'NOTICE' | 'DISPUTED'
  notes?: string | null
}

export type GoodsReceiptSource = 'SUPPLIER' | 'MARKETPLACE'

export interface GoodsReceipt {
  id: string
  company_id: string
  branch_id: string
  po_id: string
  warehouse_id: string
  gr_number: string
  source?: GoodsReceiptSource | null
  status: 'DRAFT' | 'CONFIRMED'
  received_date: string
  invoice_number: string | null
  invoice_date: string | null
  journal_id: string | null
  notes: string | null
  branch_name: string
  branch_code: string
  po_number: string
  supplier_name: string
  requires_invoice?: boolean
  invoice_bypass_reason?: 'marketplace' | 'cash' | 'informal' | null
  warehouse_name: string
  created_by_name: string | null
  confirmed_by_name: string | null
  updated_at: string
  line_count: number
  total_invoice_amount: number
  weighing_line_count?: number
  weighing_summary?: string | null
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
      invoice_number?: string | null; invoice_date?: string | null;
      notes?: string | null;
      lines: { po_line_id: string; product_id: string; qty_po_uom: number; qty_received: number; uom_received: string; unit_price_invoice: number; qty_rejected?: number; reject_reason?: string | null; notes?: string | null }[]
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
    mutationFn: async ({ id }: { id: string }) => {
      const { data } = await api.post(`/goods-receipts/${id}/confirm`)
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

// ── Attachments ──

export interface GoodsReceiptAttachment {
  id: string
  gr_id: string
  file_type: 'INVOICE' | 'DELIVERY_NOTE' | 'SURAT_JALAN' | 'PHOTO_BARANG' | 'OTHER'
  file_path: string
  file_name: string | null
  uploaded_at: string
  uploaded_by: string | null
}

export const useGRAttachments = (grId: string) =>
  useQuery({
    queryKey: ['goods-receipts', grId, 'attachments'],
    queryFn: async () => {
      const { data } = await api.get(`/goods-receipts/${grId}/attachments`)
      return data.data as GoodsReceiptAttachment[]
    },
    enabled: !!grId,
  })

export const useUploadGRAttachment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ grId, file, fileType }: { grId: string; file: File; fileType: string }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('file_type', fileType)
      const { data } = await api.post(`/goods-receipts/${grId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data as GoodsReceiptAttachment
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['goods-receipts', vars.grId, 'attachments'] })
    },
  })
}

export const useDeleteGRAttachment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ grId, attachmentId }: { grId: string; attachmentId: string }) => {
      await api.delete(`/goods-receipts/${grId}/attachments/${attachmentId}`)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['goods-receipts', vars.grId, 'attachments'] })
    },
  })
}
