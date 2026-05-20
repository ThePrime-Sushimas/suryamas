import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export type PurchaseInvoiceStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'POSTED'

export interface PiPaymentDueInfo {
  label: string
  date: string | null
  text: string | null
  confirmed: boolean
  hint: string
  term_name: string | null
  calculation_type: string | null
  base_source: 'invoice' | 'gr' | null
  base_date: string | null
}

export type PurchaseInvoiceChargeType = 'DISCOUNT' | 'SHIPPING' | 'ADMIN_FEE' | 'OTHER'

export interface PurchaseInvoiceCharge {
  id: string
  purchase_invoice_id: string
  charge_type: PurchaseInvoiceChargeType
  description: string | null
  amount: number
  tax_rate: number
  tax_amount: number
  total: number
  sort_order: number
  affects_dpp?: boolean
}

export interface PurchaseInvoice {
  id: string
  company_id: string
  supplier_id: string
  branch_id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  status: PurchaseInvoiceStatus
  notes: string | null
  rejection_reason: string | null
  subtotal: number
  total_tax: number
  total_charges: number
  total_amount: number
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  posted_by: string | null
  posted_at: string | null
  journal_id: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null

  supplier_name: string
  branch_name: string
  branch_code: string
  goods_receipt_count: number

  creator_name: string | null
  submitter_name: string | null
  approver_name: string | null
  rejector_name: string | null
  poster_name: string | null
  payment_due_info?: PiPaymentDueInfo | null
  /** From list/detail header SQL — siap untuk POST /post */
  post_journal_ready?: boolean
}


export interface PurchaseInvoiceGrLink {
  id: string
  purchase_invoice_id: string
  goods_receipt_id: string
  goods_receipt_number: string | null
  received_date: string
  supplier_id: string
  supplier_name: string
}


export interface PurchaseInvoiceLine {
  id: string
  purchase_invoice_id: string
  gr_line_id: string
  product_id: string
  qty_received: number
  qty_invoiced: number
  unit_price: number
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  qty_po: number | null
  unit_price_po: number | null
  variance_qty: number
  variance_price: number
  match_status: 'MATCH' | 'OVER' | 'UNDER'
  sort_order: number
  product_code: string
  product_name: string
  uom_received?: string
  qty_po_uom?: number
  uom_po?: string
  uom_invoice?: string
  qty_received_invoice_uom?: number
}

export interface PurchaseInvoiceGpLineAudit {
  purchase_invoice_line_id: string
  gr_line_id: string
  gp_input_id: string
  goods_processing_id: string
  processing_number: string
  processing_type: 'PASS_THROUGH' | 'DISASSEMBLY'
  gp_header_status: string
  product_code: string
  product_name: string
  requires_processing: boolean
  gp_line_status: 'PENDING' | 'PROCESSING' | 'DONE' | 'QC_REVIEW' | 'CONFIRMED' | 'REJECTED'
  qty_input: number
  uom: string
  processed_at: string | null
  processed_by_name: string | null
  qc_confirmed_at: string | null
  qc_confirmed_by_name: string | null
  rejected_at: string | null
  rejected_by_name: string | null
  rejection_reason: string | null
  outputs: Array<{
    product_name: string
    qty_output: number
    uom: string
    is_waste: boolean
  }>
}

export interface PurchaseInvoiceDetail extends PurchaseInvoice {
  gr_links: PurchaseInvoiceGrLink[]
  lines: PurchaseInvoiceLine[]
  charges: PurchaseInvoiceCharge[]
  gp_line_audits: PurchaseInvoiceGpLineAudit[]
}


interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const KEYS = {
  list: (params: Record<string, unknown>) => ['purchase-invoices', params] as const,
  detail: (id: string) => ['purchase-invoices', id] as const,
  availableGrs: (supplierId: string, branchId: string) => ['purchase-invoices', 'available-grs', supplierId, branchId] as const,
}

export const usePurchaseInvoices = (params: {
  page?: number
  limit?: number
  status?: string
  supplier_id?: string
  branch_id?: string
  date_from?: string
  date_to?: string
}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        page: params.page ?? 1,
        limit: params.limit ?? 25,
      }
      if (params.status) queryParams.status = params.status
      if (params.supplier_id) queryParams.supplier_id = params.supplier_id
      if (params.branch_id) queryParams.branch_id = params.branch_id
      if (params.date_from) queryParams.date_from = params.date_from
      if (params.date_to) queryParams.date_to = params.date_to

      const { data } = await api.get('/purchase-invoices', { params: queryParams })
      return {
        data: data.data as PurchaseInvoice[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
  })

export const usePurchaseInvoice = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/purchase-invoices/${id}`)
      return data.data as PurchaseInvoiceDetail
    },
    enabled: !!id,
  })

export const useAvailableGrs = (supplierId: string, branchId: string) =>
  useQuery({
    queryKey: KEYS.availableGrs(supplierId, branchId),
    queryFn: async () => {
      const { data } = await api.get('/purchase-invoices/available-grs', {
        params: { supplier_id: supplierId, branch_id: branchId },
      })
      return data.data as any[] // Replace any with GR type if available
    },
    enabled: !!supplierId && !!branchId,
  })

export const useCreatePurchaseInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/purchase-invoices', body)
      return data.data as PurchaseInvoice
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
    },
  })
}

export const useUpdatePurchaseInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const { data } = await api.put(`/purchase-invoices/${id}`, body)
      return data.data as PurchaseInvoice
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
    },
  })
}

export const useSubmitPurchaseInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/purchase-invoices/${id}/submit`)
      return data.data as PurchaseInvoice
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
    },
  })
}

export const useApprovePurchaseInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/purchase-invoices/${id}/approve`)
      return data.data as PurchaseInvoice
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
    },
  })
}

export const useRejectPurchaseInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await api.post(`/purchase-invoices/${id}/reject`, { rejection_reason: reason })
      return data.data as PurchaseInvoice
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) })
    },
  })
}

export const usePostPurchaseInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/purchase-invoices/${id}/post`)
      return data.data as PurchaseInvoice
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices', 'counts'] })
    },
  })
}

export const useDeletePurchaseInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/purchase-invoices/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
    },
  })
}

export const usePurchaseInvoiceAttachments = (id: string) =>
  useQuery({
    queryKey: ['purchase-invoices', id, 'attachments'],
    queryFn: async () => {
      const { data } = await api.get(`/purchase-invoices/${id}/attachments`)
      return data.data as any[]
    },
    enabled: !!id,
  })

export const usePurchaseInvoiceCounts = () =>
  useQuery({
    queryKey: ['purchase-invoices', 'counts'],
    queryFn: async () => {
      const { data } = await api.get('/purchase-invoices/counts')
      return data.data as {
        verify_count: number
        approval_count: number
        final_count: number
      }
    },
    staleTime: 30_000,
  })

export const useMergePurchaseInvoices = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (invoiceIds: string[]) => {
      const { data } = await api.post('/purchase-invoices/merge', {
        invoice_ids: invoiceIds,
      })
      return data.data as PurchaseInvoice
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-invoices'] })
    },
  })
}
