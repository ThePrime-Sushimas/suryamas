import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { ApPaymentListQuery } from '../types/apPaymentFilters.types'

export type ApPaymentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'RECONCILED'

export type ApPaymentMethod = 'TRANSFER' | 'CASH' | 'CHECK' | 'GIRO'

export interface ApPaymentInvoiceLine {
  id: string
  ap_payment_id: string
  purchase_invoice_id: string
  amount_paid: number | string
  notes: string | null
  invoice_number: string
  invoice_date: string
  invoice_total_amount: number | string
  supplier_name: string
  invoice_outstanding: number | string
}

export interface ApPayment {
  id: string
  company_id: string
  branch_id: string
  payment_number: string
  supplier_id: string
  bank_account_id: number
  payment_method: ApPaymentMethod
  total_amount: number | string
  payment_date: string | null
  notes: string | null
  rejection_reason: string | null
  status: ApPaymentStatus
  proof_url: string | null
  proof_uploaded_at: string | null
  bank_statement_id: number | null
  journal_id: string | null
  reconciled_at: string | null
  requested_at: string | null
  approved_at: string | null
  rejected_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
  supplier_name: string
  branch_name: string
  branch_code: string
  bank_account_name: string
  bank_account_number: string
  invoice_count: number
  lines?: ApPaymentInvoiceLine[]
}

export interface ApOutstandingInvoice {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  supplier_id: string
  supplier_name: string
  branch_id: string
  branch_name: string
  total_amount: number | string
  total_paid: number | string
  outstanding: number | string
  is_overdue: boolean
}

export interface CreateApPaymentLineDto {
  purchase_invoice_id: string
  amount_paid: number
  notes?: string | null
}

export interface CreateApPaymentDto {
  branch_id?: string
  supplier_id: string
  bank_account_id: number
  payment_method: ApPaymentMethod
  total_amount: number
  payment_date?: string | null
  notes?: string | null
  lines: CreateApPaymentLineDto[]
}

export interface UpdateApPaymentDto {
  bank_account_id?: number
  payment_method?: ApPaymentMethod
  total_amount?: number
  payment_date?: string | null
  notes?: string | null
  lines?: CreateApPaymentLineDto[]
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext?: boolean
  hasPrev?: boolean
}

const KEYS = {
  list: (params: ApPaymentListQuery) => ['ap-payments', params] as const,
  detail: (id: string) => ['ap-payments', id] as const,
  outstanding: (params: Record<string, string | boolean | undefined>) =>
    ['ap-payments', 'outstanding', params] as const,
}

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0
}

export function normalizeApPayment(row: ApPayment): ApPayment {
  return {
    ...row,
    total_amount: toNumber(row.total_amount),
    lines: row.lines?.map((l) => ({
      ...l,
      amount_paid: toNumber(l.amount_paid),
      invoice_total_amount: toNumber(l.invoice_total_amount),
      invoice_outstanding: toNumber(l.invoice_outstanding),
    })),
  }
}

export const useApPayments = (params: ApPaymentListQuery = {}) =>
  useQuery({
    queryKey: KEYS.list(params),
    queryFn: async () => {
      const safeParams = {
        ...params,
        ...(params.limit != null
          ? { limit: Math.min(100, Math.max(1, params.limit)) }
          : {}),
      }
      const { data } = await api.get('/ap-payments', { params: safeParams })
      const rows = (data.data ?? []) as ApPayment[]
      return {
        data: rows.map(normalizeApPayment),
        pagination: data.pagination as PaginationMeta,
      }
    },
  })

export const useApPayment = (id: string) =>
  useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get(`/ap-payments/${id}`)
      return normalizeApPayment(data.data as ApPayment)
    },
    enabled: !!id,
  })

export const useOutstandingInvoices = (params: {
  supplier_id?: string
  branch_id?: string
  overdue_only?: boolean
}) =>
  useQuery({
    queryKey: KEYS.outstanding(params),
    queryFn: async () => {
      const { data } = await api.get('/ap-payments/outstanding-invoices', {
        params: {
          ...params,
          overdue_only: params.overdue_only ? 'true' : undefined,
        },
      })
      return (data.data ?? []) as ApOutstandingInvoice[]
    },
    enabled: !!params.supplier_id,
  })

export const useCreateApPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateApPaymentDto) => {
      const { data } = await api.post('/ap-payments', body)
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap-payments'] }),
  })
}

export const useUpdateApPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateApPaymentDto }) => {
      const { data } = await api.patch(`/ap-payments/${id}`, body)
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(v.id) })
    },
  })
}

export const useDeleteApPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ap-payments/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ap-payments'] }),
  })
}

export const useSubmitApPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/ap-payments/${id}/submit`)
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
    },
  })
}

export const useApproveApPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/ap-payments/${id}/approve`)
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
    },
  })
}

export const useRejectApPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rejection_reason }: { id: string; rejection_reason: string }) => {
      const { data } = await api.post(`/ap-payments/${id}/reject`, { rejection_reason })
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(v.id) })
    },
  })
}

export const useUploadApPaymentProof = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, proof_url }: { id: string; proof_url: string }) => {
      const { data } = await api.post(`/ap-payments/${id}/proof`, { proof_url })
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(v.id) })
    },
  })
}

export const useMarkApPaymentPaid = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payment_date }: { id: string; payment_date?: string }) => {
      const { data } = await api.post(`/ap-payments/${id}/pay`, { payment_date })
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(v.id) })
    },
  })
}

export const useReconcileApPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      bank_statement_id,
    }: {
      id: string
      bank_statement_id: number
    }) => {
      const { data } = await api.post(`/ap-payments/${id}/reconcile`, { bank_statement_id })
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(v.id) })
    },
  })
}
