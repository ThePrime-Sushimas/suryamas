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
  invoice_due_date: string | null
  invoice_status?: string
  invoice_subtotal: number | string
  invoice_tax: number | string
  invoice_total_amount: number | string
  supplier_name: string
  invoice_outstanding: number | string
  gr_numbers: string | null
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
  journal_number?: string | null
  journal_status?: string | null
  bulk_payment_batch_id: string | null
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
  bank_name?: string
  supplier_bank_account_id?: number | null
  supplier_bank_name?: string | null
  supplier_bank_account_number?: string | null
  supplier_bank_account_name?: string | null
  invoice_count: number
  lines?: ApPaymentInvoiceLine[]
  // Employee names for timeline
  created_by_name?: string | null
  requested_by_name?: string | null
  approved_by_name?: string | null
  rejected_by_name?: string | null
  paid_by_name?: string | null
}

export type PurchaseInvoicePayableStatus = 'APPROVED' | 'POSTED'

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
  invoice_status: PurchaseInvoicePayableStatus
  can_pay: boolean
  ap_payment_id: string | null
  ap_payment_number: string | null
}

export interface ApDashboardAgingBucket {
  bucket: string
  label: string
  amount: number
  invoice_count: number
}

export interface ApDashboardSupplierRow {
  supplier_id: string
  supplier_name: string
  supplier_code: string | null
  pending_post_amount: number
  pending_post_count: number
  ready_to_pay_amount: number
  ready_to_pay_count: number
  total_outstanding: number
  overdue_amount: number
  aging: ApDashboardAgingBucket[]
}

export interface ApDashboardSummary {
  pending_post_amount: number
  pending_post_count: number
  ready_to_pay_amount: number
  ready_to_pay_count: number
  total_outstanding: number
  overdue_amount: number
  supplier_count: number
}

export interface ApDueDatePivotRow {
  due_date: string | null
  supplier_id: string
  supplier_name: string
  supplier_code: string | null
  branch_id: string
  branch_name: string
  branch_code: string
  company_id: string
  company_name: string
  company_type: string | null
  invoice_status: PurchaseInvoicePayableStatus
  can_pay: boolean
  outstanding: number
  invoice_count: number
  is_overdue: boolean
  supplier_bank_name: string | null
  supplier_account_number: string | null
  supplier_account_holder: string | null
  ap_payment_id: string | null
  ap_payment_number: string | null
  pay_from_bank_name: string | null
  pay_from_account_number: string | null
  pay_from_account_holder: string | null
}

export interface ApDueDatePivotGroup {
  due_date: string | null
  due_date_label: string
  is_overdue: boolean
  is_today: boolean
  total_outstanding: number
  total_invoice_count: number
  rows: ApDueDatePivotRow[]
}

export type ApPivotLocationGrouping = 'branch' | 'entity'

export interface ApDashboardResponse {
  summary: ApDashboardSummary
  aging_totals: ApDashboardAgingBucket[]
  suppliers: ApDashboardSupplierRow[]
  due_date_pivot: ApDueDatePivotGroup[]
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

export interface OutstandingInvoicesQuery {
  supplier_id?: string
  branch_id?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  limit?: number
}

export interface OutstandingInvoiceRow {
  id: string
  invoice_number: string
  invoice_date: string
  supplier_id: string
  supplier_name: string
  branch_id: string
  branch_name: string
  total_amount: number
  remaining_amount: number
  due_date: string | null
  aging_days: number | null
  invoice_status: 'APPROVED' | 'POSTED'
  assigned_bank_account_id: number | null
  supplier_bank_account_id: number | null
  earliest_received_date: string | null
  supplier_bank_accounts: Array<{
    id: number
    bank_name: string
    account_number: string
    account_name: string
  }>
}

const KEYS = {
  list: (params: ApPaymentListQuery) => ['ap-payments', params] as const,
  detail: (id: string) => ['ap-payments', id] as const,
  dashboard: (branchId?: string) => ['ap-payments', 'dashboard', branchId ?? 'all'] as const,
  outstanding: (params: Record<string, string | boolean | undefined>) =>
    ['ap-payments', 'outstanding', params] as const,
  outstandingPaginated: (params: OutstandingInvoicesQuery) =>
    ['ap-payments', 'outstanding-paginated', params] as const,
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

export const useApDashboard = (branchId?: string) =>
  useQuery({
    queryKey: KEYS.dashboard(branchId),
    queryFn: async () => {
      const { data } = await api.get('/ap-payments/dashboard', {
        params: branchId ? { branch_id: branchId } : undefined,
      })
      return data.data as ApDashboardResponse
    },
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

export const useOutstandingInvoicesPaginated = (params: OutstandingInvoicesQuery) =>
  useQuery({
    queryKey: KEYS.outstandingPaginated(params),
    queryFn: async () => {
      const { data } = await api.get('/ap-payments/outstanding-invoices/paginated', {
        params,
      })
      return {
        data: (data.data ?? []) as OutstandingInvoiceRow[],
        pagination: data.pagination as PaginationMeta,
      }
    },
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
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData()
      formData.append('proof', file)
      const { data } = await api.post(`/ap-payments/${id}/proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
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
      qc.invalidateQueries({ queryKey: ['accounting', 'journals'] })
    },
  })
}

export const usePostApPaymentJournal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/ap-payments/${id}/post-journal`)
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
      qc.invalidateQueries({ queryKey: ['accounting', 'journals'] })
    },
  })
}

export const useDeleteApPaymentJournal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/ap-payments/${id}/journal`)
      return normalizeApPayment(data.data as ApPayment)
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
      qc.invalidateQueries({ queryKey: ['accounting', 'journals'] })
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

// --- Bulk Payment ---

export interface BulkCreateApPaymentDto {
  batch_notes?: string | null
  payments: Array<{
    supplier_id: string
    bank_account_id: number
    supplier_bank_account_id?: number | null
    payment_method: ApPaymentMethod
    invoice_lines: Array<{
      purchase_invoice_id: string
      amount_paid: number
    }>
    notes?: string | null
  }>
}

export interface BulkCreateApPaymentResponse {
  batch_id: string
  total_payments: number
  total_amount: number
  payments: Array<{
    id: string
    payment_number: string
    supplier_name: string
    total_amount: number
  }>
}

export const useCreateBulkPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: BulkCreateApPaymentDto) => {
      const { data } = await api.post('/ap-payments/bulk', body)
      return data.data as BulkCreateApPaymentResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
    },
  })
}

export const useCreateBulkPaymentV2 = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/ap-payments/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      return data.data as BulkCreateApPaymentResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap-payments'] })
    },
  })
}

/**
 * Assign (or clear) a bank account to an outstanding invoice.
 * Used for inline auto-save in the Outstanding Invoices tab.
 */
export const useAssignBankAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ invoiceId, bankAccountId }: { invoiceId: string; bankAccountId: number | null }) => {
      const { data } = await api.patch(`/ap-payments/outstanding-invoices/${invoiceId}/assign`, {
        bank_account_id: bankAccountId,
      })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap-payments', 'bulk-invoices'] })
      qc.invalidateQueries({ queryKey: ['ap-payments', 'outstanding-paginated'] })
    },
  })
}

export const useAssignSupplierBankAccount = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      invoiceId,
      supplierBankAccountId,
    }: {
      invoiceId: string
      supplierBankAccountId: number | null
    }) => {
      const { data } = await api.patch(
        `/ap-payments/outstanding-invoices/${invoiceId}/assign-supplier-bank`,
        { supplier_bank_account_id: supplierBankAccountId },
      )
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ap-payments', 'bulk-invoices'] })
      qc.invalidateQueries({ queryKey: ['ap-payments', 'outstanding-paginated'] })
    },
  })
}

// --- Combined Invoice + Payment (Gabungan tab) ---

export interface CombinedInvoicePaymentQuery {
  supplier_id?: string
  branch_id?: string
  date_from?: string
  date_to?: string
  due_date_from?: string
  due_date_to?: string
  received_date_from?: string
  received_date_to?: string
  search?: string
  status?: string
  page?: number
  limit?: number
}

export interface CombinedInvoicePaymentRow {
  invoice_id: string
  invoice_number: string
  invoice_date: string
  invoice_due_date: string | null
  invoice_status: string
  invoice_total_amount: number
  invoice_remaining_amount: number
  supplier_id: string
  supplier_name: string
  branch_id: string
  branch_name: string
  payment_id: string | null
  payment_number: string | null
  payment_status: string | null
  payment_method: string | null
  payment_date: string | null
  payment_amount: number | null
  paid_at: string | null
  source_bank_name: string | null
  source_account_number: string | null
  source_account_name: string | null
  dest_bank_name: string | null
  dest_account_number: string | null
  dest_account_name: string | null
  aging_days: number | null
  is_overdue: boolean
  earliest_received_date: string | null
}

export const useCombinedInvoicePayments = (params: CombinedInvoicePaymentQuery) =>
  useQuery({
    queryKey: ['ap-payments', 'combined', params] as const,
    queryFn: async () => {
      const { data } = await api.get('/ap-payments/combined', { params })
      return {
        data: (data.data ?? []) as CombinedInvoicePaymentRow[],
        pagination: data.pagination as PaginationMeta,
      }
    },
  })
