import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { parseApiError } from '@/lib/errorParser'
import { useToast } from '@/contexts/ToastContext'
import type { PurchaseOrderListQuery } from '../types/purchaseOrderFilters.types'

export interface PurchaseOrderLine {
  id?: string
  pr_line_id?: string | null
  product_id: string
  product_code?: string
  product_name?: string
  supplier_product_id?: string | null
  qty: number
  qty_received?: number
  qty_short_closed?: number
  short_close_reason?: string | null
  uom: string
  unit_price: number
  total_price?: number
  notes?: string | null
}

/**
 * Qty yang masih dihitung ke nilai PO (setelah tutup sisa).
 * Payable aktual mengikuti GR/invoice — ini nilai komitmen PO internal.
 */
export function poLineCommittedQty(line: Pick<PurchaseOrderLine, 'qty' | 'qty_short_closed'>): number {
  return Math.max(0, Number(line.qty) - Number(line.qty_short_closed ?? 0))
}

/** Selalu (qty - qty_short_closed) × unit_price — sama dengan backend recalculatePoAmounts. */
export function poLineCommittedSubtotal(
  line: Pick<PurchaseOrderLine, 'qty' | 'qty_short_closed' | 'unit_price'>,
): number {
  return poLineCommittedQty(line) * Number(line.unit_price)
}

export function poCommittedTotalAmount(lines: PurchaseOrderLine[] | undefined): number {
  return (lines ?? []).reduce((sum, line) => sum + poLineCommittedSubtotal(line), 0)
}

export interface PoPaymentDueInfo {
  label: string
  date: string | null
  text: string | null
  confirmed: boolean
  hint: string
  term_name: string | null
  calculation_type: string | null
}

export interface PurchaseOrder {
  id: string
  company_id: string
  branch_id: string
  supplier_id: string
  purchase_request_id: string
  po_number: string
  status: 'DRAFT' | 'SENT' | 'ORDERED' | 'PARTIAL_RECEIVED' | 'FULLY_RECEIVED' | 'CLOSED' | 'CANCELLED'
  order_date: string
  expected_delivery_date: string | null
  payment_type: 'CASH' | 'CREDIT'
  payment_terms_days: number | null
  payment_due_date: string | null
  payment_term_name: string | null
  payment_due_info: PoPaymentDueInfo | null
  notes: string | null
  pr_notes: string | null
  approved_by_name: string | null
  approved_at: string | null
  cancelled_reason: string | null
  total_amount: number
  branch_name: string
  branch_code: string
  supplier_name: string
  supplier_code: string
  request_number: string
  line_count: number
  created_at: string
  lines?: PurchaseOrderLine[]
  // Computed overdue fields
  overdue_days: number | null
  overdue_trigger_product: string | null
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }

const KEYS = {
  list: (params: PurchaseOrderListQuery) => ['purchase-orders', params] as const,
  detail: (id: string) => ['purchase-orders', id] as const,
  paymentDuePreview: (id: string, expectedDate?: string) =>
    ['purchase-orders', id, 'payment-due-preview', expectedDate ?? ''] as const,
}

export const usePurchaseOrders = (params: PurchaseOrderListQuery = {}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = { page: params.page ?? 1, limit: params.limit ?? 25 }
      if (params.status) queryParams.status = params.status
      if (params.supplier_id) queryParams.supplier_id = params.supplier_id
      if (params.branch_id) queryParams.branch_id = params.branch_id
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to
      if (params.search) queryParams.q = params.search
      const { data } = await api.get('/purchase-orders', { params: queryParams })
      return { data: data.data as PurchaseOrder[], pagination: data.pagination as Pagination }
    },
    staleTime: 30_000,
  })

export const usePurchaseOrder = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/purchase-orders/${id}`)
      return data.data as PurchaseOrder
    },
    enabled: !!id,
  })

/** Pass debounced expectedDeliveryDate from the parent to limit refetches while typing. */
export const usePaymentDuePreview = (
  id: string,
  expectedDeliveryDate: string,
  enabled: boolean
) =>
  useQuery({
    queryKey: KEYS.paymentDuePreview(id, expectedDeliveryDate || '__po_default__'),
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (expectedDeliveryDate) params.expected_delivery_date = expectedDeliveryDate
      const { data } = await api.get(`/purchase-orders/${id}/payment-due-preview`, { params })
      return data.data as { payment_term_name: string | null; payment_due_info: PoPaymentDueInfo | null }
    },
    enabled: Boolean(id) && enabled,
    staleTime: 10_000,
  })

export const useUpdatePurchaseOrder = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; expected_delivery_date?: string | null; notes?: string | null; lines?: { product_id: string; qty: number; uom: string; unit_price: number; pr_line_id?: string | null }[] }) => {
      const { data } = await api.put(`/purchase-orders/${id}`, body)
      return data.data as PurchaseOrder
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal memperbarui purchase order')),
  })
}


export const useMarkSentPurchaseOrder = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (id: string) => { await api.post(`/purchase-orders/${id}/send`) },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal menandai PO terkirim')),
  })
}

export const useMarkOrderedPurchaseOrder = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (id: string) => { await api.post(`/purchase-orders/${id}/mark-ordered`) },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal menandai PO sudah dipesan')),
  })
}

export type PoShortCloseReason =
  | 'SUPPLIER_OUT_OF_STOCK'
  | 'SUPPLIER_CANCELLED'
  | 'SUBSTITUTE_UNAVAILABLE'
  | 'OTHER'

export const PO_SHORT_CLOSE_REASONS: { value: PoShortCloseReason; label: string }[] = [
  { value: 'SUPPLIER_OUT_OF_STOCK', label: 'Stok habis di supplier' },
  { value: 'SUPPLIER_CANCELLED', label: 'Dibatalkan supplier' },
  { value: 'SUBSTITUTE_UNAVAILABLE', label: 'Substitusi tidak tersedia' },
  { value: 'OTHER', label: 'Lainnya' },
]

export const useShortClosePoLines = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({
      id,
      lines,
    }: {
      id: string
      lines: { po_line_id: string; qty: number; reason: PoShortCloseReason; notes?: string | null }[]
    }) => {
      const { data } = await api.post(`/purchase-orders/${id}/short-close-lines`, { lines })
      return data.data as PurchaseOrder
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Gagal menutup sisa PO')),
  })
}

export const useCancelPurchaseOrder = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ id, cancelled_reason }: { id: string; cancelled_reason: string }) => {
      await api.post(`/purchase-orders/${id}/cancel`, { cancelled_reason })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
    onError: (err) => toast.error(parseApiError(err, 'Gagal membatalkan purchase order')),
  })
}

export const useDeletePurchaseOrder = () => {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/purchase-orders/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
    onError: (err) => toast.error(parseApiError(err, 'Gagal menghapus purchase order')),
  })
}

/** Check for duplicate POs (same supplier + branch + similar amount in 30 days) */
export const useCheckDuplicatePO = (params: { supplier_id?: string; branch_id?: string; total_amount?: number }) =>
  useQuery({
    queryKey: ['purchase-orders', 'check-duplicates', params],
    queryFn: async () => {
      const { data } = await api.get('/purchase-orders/check-duplicates', { params })
      return data.data as { count: number; similar_pos: { id: string; po_number: string; total_amount: number; order_date: string; status: string; supplier_name: string }[] }
    },
    enabled: !!params.supplier_id && !!params.branch_id && (params.total_amount ?? 0) > 0,
    staleTime: 10_000,
  })

/** Get latest price for a product (from GR history or supplier_products) */
export const getLatestPrice = async (productId: string, supplierId?: string): Promise<{ price: number; source: string }> => {
  const params: Record<string, string> = { product_id: productId }
  if (supplierId) params.supplier_id = supplierId
  const { data } = await api.get('/purchase-orders/latest-price', { params })
  return data.data
}
