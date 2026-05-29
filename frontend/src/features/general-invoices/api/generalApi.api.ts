import api from '@/lib/axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Types (mirror backend) ───────────────────────────────────
export type VendorType = 'UTILITY' | 'RENT' | 'SERVICE' | 'SUBSCRIPTION' | 'OTHER'
export type TransactionType = 'EXPENSE' | 'PREPAID'
export type GeneralInvoiceStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'
export type GeneralPaymentStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'PAID' | 'RECONCILED'
export type RecurrenceType = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type PaymentMethod = 'TRANSFER' | 'CASH'
export type AmortizationStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface Vendor {
  id: string
  company_id: string
  vendor_code: string
  vendor_name: string
  vendor_type: VendorType | null
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GeneralInvoiceLine {
  id: string
  general_invoice_id: string
  line_number: number
  account_id: string
  account_code: string
  account_name: string
  description: string | null
  amount: number
  tax_amount: number
  tax_account_id: string | null
  tax_account_code: string | null
  tax_account_name: string | null
  total_amount: number
  transaction_type: TransactionType
  expense_account_id: string | null
  expense_account_code: string | null
  expense_account_name: string | null
  total_periods: number | null
  amortization_start_date: string | null
}

export interface GeneralInvoice {
  id: string
  company_id: string
  branch_id: string
  branch_name: string
  invoice_number: string
  vendor_id: string
  vendor_name: string
  vendor_type: VendorType | null
  invoice_date: string
  due_date: string | null
  period_start: string | null
  period_end: string | null
  is_confidential: boolean
  subtotal: number
  total_tax: number
  total_amount: number
  notes: string | null
  attachment_url: string | null
  status: GeneralInvoiceStatus
  journal_id: string | null
  journal_number: string | null
  template_id: string | null
  posted_by: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
  active_payment?: GeneralInvoicePaymentSummary | null
}

export interface GeneralInvoicePaymentSummary {
  id: string
  payment_number: string
  status: GeneralPaymentStatus
  total_amount: number
  payment_date: string | null
  paid_at: string | null
}

export interface GeneralInvoiceDetail extends GeneralInvoice {
  lines: GeneralInvoiceLine[]
  payment: GeneralInvoicePaymentSummary | null
}

export interface GeneralInvoicePayment {
  id: string
  company_id: string
  branch_id: string
  branch_name: string
  payment_number: string
  general_invoice_id: string
  invoice_number: string
  vendor_name: string
  bank_account_id: number
  bank_account_name: string | null
  payment_method: PaymentMethod
  total_amount: number
  payment_date: string | null
  notes: string | null
  proof_url: string | null
  proof_uploaded_at: string | null
  status: GeneralPaymentStatus
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null
  paid_by: string | null
  paid_at: string | null
  journal_id: string | null
  journal_number: string | null
  reconciled_at: string | null
  created_at: string
  updated_at: string
}

export interface GeneralApDashboard {
  summary: {
    total_unpaid: number
    total_unpaid_count: number
    overdue_amount: number
    overdue_count: number
    due_this_week: number
    due_this_week_count: number
    draft_count: number
    posted_count: number
  }
  pending_amortizations: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}



// ─── Query Keys ───────────────────────────────────────────────
const KEYS = {
  vendors: ['general-ap', 'vendors'] as const,
  vendorList: (params: Record<string, unknown>) => [...KEYS.vendors, 'list', params] as const,
  vendorDetail: (id: string) => [...KEYS.vendors, id] as const,

  invoices: ['general-ap', 'invoices'] as const,
  invoiceList: (params: Record<string, unknown>) => [...KEYS.invoices, 'list', params] as const,
  invoiceDetail: (id: string) => [...KEYS.invoices, id] as const,
  invoiceDashboard: (params: Record<string, unknown>) => [...KEYS.invoices, 'dashboard', params] as const,

  payments: ['general-ap', 'payments'] as const,
  paymentList: (params: Record<string, unknown>) => [...KEYS.payments, 'list', params] as const,
  paymentDetail: (id: string) => [...KEYS.payments, id] as const,

  templates: ['general-ap', 'templates'] as const,
  templateDetail: (id: string) => [...KEYS.templates, id] as const,
}

export interface GeneralInvoiceTemplateLine {
  id: string
  template_id: string
  line_number: number
  account_id: string
  account_code: string
  account_name: string
  description: string | null
  amount_ratio: number | null
  transaction_type: TransactionType
  tax_account_id: string | null
  tax_account_code: string | null
  tax_account_name: string | null
  expense_account_id: string | null
  expense_account_code: string | null
  expense_account_name: string | null
  total_periods: number | null
  amortization_start_offset_days: number | null
}

export interface GeneralInvoiceTemplate {
  id: string
  company_id: string
  branch_id: string
  template_name: string
  vendor_id: string
  vendor_name: string
  is_confidential: boolean
  recurrence: RecurrenceType
  default_amount: number | null
  due_date_offset_days: number
  notes: string | null
  is_active: boolean
  last_generated_at: string | null
  lines: GeneralInvoiceTemplateLine[]
  created_at: string
  updated_at: string
}

// ============================================================
// VENDOR HOOKS
// ============================================================
export const useVendors = (params?: {
  search?: string
  vendor_type?: VendorType
  is_active?: boolean
  sort_by?: string
  sort_order?: string
  page?: number
  limit?: number
}) =>
  useQuery({
    queryKey: KEYS.vendorList(params ?? {}),
    queryFn: async () => {
      const { data } = await api.get('/vendors', { params })
      return {
        data: data.data as Vendor[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
  })

export const useVendor = (id: string) =>
  useQuery({
    queryKey: KEYS.vendorDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/vendors/${id}`)
      return data.data as Vendor
    },
    enabled: !!id,
  })

export const useCreateVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      vendor_code: string
      vendor_name: string
      vendor_type?: VendorType
      contact_person?: string
      phone?: string
      email?: string
      address?: string
      bank_name?: string
      bank_account_number?: string
      bank_account_name?: string
      notes?: string
    }) => {
      const { data } = await api.post('/vendors', body)
      return data.data as Vendor
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.vendors })
    },
  })
}

export const useUpdateVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: {
      id: string
      body: Partial<{
        vendor_code: string
        vendor_name: string
        vendor_type: VendorType | null
        contact_person: string | null
        phone: string | null
        email: string | null
        address: string | null
        bank_name: string | null
        bank_account_number: string | null
        bank_account_name: string | null
        notes: string | null
        is_active: boolean
      }>
    }) => {
      const { data } = await api.put(`/vendors/${id}`, body)
      return data.data as Vendor
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.vendors })
      qc.invalidateQueries({ queryKey: KEYS.vendorDetail(vars.id) })
    },
  })
}

export const useDeleteVendor = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/vendors/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.vendors })
    },
  })
}

// ============================================================
// GENERAL INVOICE HOOKS
// ============================================================
export const useGeneralInvoiceDashboard = (params?: { branch_id?: string }) =>
  useQuery({
    queryKey: KEYS.invoiceDashboard(params ?? {}),
    queryFn: async () => {
      const { data } = await api.get('/general-invoices/dashboard', { params })
      return data.data as GeneralApDashboard
    },
    staleTime: 30_000,
  })

export const useGeneralInvoices = (params?: {
  branch_id?: string
  vendor_id?: string
  status?: GeneralInvoiceStatus
  overdue?: boolean
  due_date_from?: string
  due_date_to?: string
  invoice_date_from?: string
  invoice_date_to?: string
  search?: string
  page?: number
  limit?: number
}) =>
  useQuery({
    queryKey: KEYS.invoiceList(params ?? {}),
    queryFn: async () => {
      const { data } = await api.get('/general-invoices', { params })
      return {
        data: data.data as GeneralInvoice[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
  })

export const useGeneralInvoice = (id: string) =>
  useQuery({
    queryKey: KEYS.invoiceDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/general-invoices/${id}`)
      return data.data as GeneralInvoiceDetail
    },
    enabled: !!id,
  })

export const useCreateGeneralInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      vendor_id: string
      invoice_date: string
      due_date?: string | null
      period_start?: string | null
      period_end?: string | null
      is_confidential?: boolean
      notes?: string | null
      attachment_url?: string | null
      lines: Array<{
        line_number: number
        account_id: string
        description?: string | null
        amount: number
        tax_amount?: number
        transaction_type?: TransactionType
        expense_account_id?: string
        total_periods?: number
        amortization_start_date?: string
      }>
    }) => {
      const { data } = await api.post('/general-invoices', body)
      return data.data as GeneralInvoiceDetail
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.invoices })
    },
  })
}

export const useUpdateGeneralInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: {
      id: string
      body: {
        vendor_id?: string
        invoice_date?: string
        due_date?: string | null
        period_start?: string | null
        period_end?: string | null
        is_confidential?: boolean
        notes?: string | null
        attachment_url?: string | null
        lines?: Array<{
          line_number: number
          account_id: string
          description?: string | null
          amount: number
          tax_amount?: number
          transaction_type?: TransactionType
          expense_account_id?: string
          total_periods?: number
          amortization_start_date?: string
        }>
      }
    }) => {
      const { data } = await api.put(`/general-invoices/${id}`, body)
      return data.data as GeneralInvoiceDetail
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.invoices })
      qc.invalidateQueries({ queryKey: KEYS.invoiceDetail(vars.id) })
    },
  })
}

export const usePostGeneralInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/general-invoices/${id}/post`)
      return data.data as GeneralInvoiceDetail
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: KEYS.invoices })
      qc.invalidateQueries({ queryKey: KEYS.invoiceDetail(id) })
      qc.invalidateQueries({ queryKey: ['general-ap', 'invoices', 'dashboard'] })
    },
  })
}

export const useCancelGeneralInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/general-invoices/${id}/cancel`)
      return data.data as GeneralInvoiceDetail
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: KEYS.invoices })
      qc.invalidateQueries({ queryKey: KEYS.invoiceDetail(id) })
    },
  })
}

export const useDeleteGeneralInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/general-invoices/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.invoices })
    },
  })
}

// ============================================================
// PAYMENT HOOKS
// ============================================================
export const useGeneralPayments = (params?: {
  branch_id?: string
  vendor_id?: string
  status?: GeneralPaymentStatus
  payment_date_from?: string
  payment_date_to?: string
  search?: string
  page?: number
  limit?: number
}) =>
  useQuery({
    queryKey: KEYS.paymentList(params ?? {}),
    queryFn: async () => {
      const { data } = await api.get('/general-invoice-payments', { params })
      return {
        data: data.data as GeneralInvoicePayment[],
        pagination: data.pagination as Pagination,
      }
    },
    staleTime: 30_000,
  })

export const useGeneralPayment = (id: string) =>
  useQuery({
    queryKey: KEYS.paymentDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/general-invoice-payments/${id}`)
      return data.data as GeneralInvoicePayment
    },
    enabled: !!id,
  })

export const useCreateGeneralPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      general_invoice_id: string
      bank_account_id: number
      payment_method?: PaymentMethod
      total_amount: number
      payment_date?: string | null
      notes?: string | null
    }) => {
      const { data } = await api.post('/general-invoice-payments', body)
      return data.data as GeneralInvoicePayment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.payments })
      qc.invalidateQueries({ queryKey: KEYS.invoices })
    },
  })
}

export const useApproveGeneralPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/general-invoice-payments/${id}/approve`)
      return data.data as GeneralInvoicePayment
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: KEYS.payments })
      qc.invalidateQueries({ queryKey: KEYS.paymentDetail(id) })
    },
  })
}

export const useRejectGeneralPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await api.post(`/general-invoice-payments/${id}/reject`, { reason })
      return data.data as GeneralInvoicePayment
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.payments })
      qc.invalidateQueries({ queryKey: KEYS.paymentDetail(vars.id) })
    },
  })
}

export const useUploadProofGeneralPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/general-invoice-payments/${id}/upload-proof`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data as GeneralInvoicePayment
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.paymentDetail(vars.id) })
      qc.invalidateQueries({ queryKey: KEYS.payments })
    },
  })
}

export const useUploadGeneralInvoiceAttachment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/general-invoices/${id}/attachment`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data as GeneralInvoiceDetail
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.invoiceDetail(vars.id) })
      qc.invalidateQueries({ queryKey: KEYS.invoices })
    },
  })
}

export interface CompanyBankAccountOption {
  id: number
  account_name: string
  account_number: string
  bank_name?: string
}

// ============================================================
// TEMPLATE HOOKS
// ============================================================
export const useGeneralInvoiceTemplates = () =>
  useQuery({
    queryKey: KEYS.templates,
    queryFn: async () => {
      const { data } = await api.get('/general-invoice-templates')
      return data.data as GeneralInvoiceTemplate[]
    },
    staleTime: 30_000,
  })

export const useGeneralInvoiceTemplate = (id: string) =>
  useQuery({
    queryKey: KEYS.templateDetail(id),
    queryFn: async () => {
      const { data } = await api.get(`/general-invoice-templates/${id}`)
      return data.data as GeneralInvoiceTemplate
    },
    enabled: !!id,
  })

export const useCreateGeneralInvoiceTemplate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      branch_id?: string
      template_name: string
      vendor_id: string
      is_confidential?: boolean
      recurrence: RecurrenceType
      default_amount?: number | null
      due_date_offset_days?: number
      notes?: string | null
      lines: Array<{
        line_number: number
        account_id: string
        description?: string | null
        amount_ratio?: number | null
        transaction_type?: TransactionType
        expense_account_id?: string
        total_periods?: number
        amortization_start_offset_days?: number
      }>
    }) => {
      const { data } = await api.post('/general-invoice-templates', body)
      return data.data as GeneralInvoiceTemplate
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.templates })
    },
  })
}

export const useDeleteGeneralInvoiceTemplate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/general-invoice-templates/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.templates })
    },
  })
}

export const useGenerateFromTemplate = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      template_id: string
      invoice_date: string
      invoice_number?: string
      line_amounts?: Array<{ line_number: number; amount: number; tax_amount?: number }>
      notes?: string | null
    }) => {
      const { data } = await api.post('/general-invoice-templates/generate', body)
      return data.data as GeneralInvoiceDetail
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.invoices })
      qc.invalidateQueries({ queryKey: KEYS.templates })
    },
  })
}

export function useCompanyBankAccounts(companyId?: string) {
  return useQuery({
    queryKey: ['bank-accounts', 'company', companyId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        owner_type: 'company',
        is_active: true,
        limit: 200,
      }
      if (companyId) params.owner_id = companyId
      const { data } = await api.get('/bank-accounts', { params })
      return (data.data ?? []) as CompanyBankAccountOption[]
    },
    staleTime: 5 * 60_000,
  })
}

export const useMarkPaidGeneralPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payment_date }: { id: string; payment_date?: string }) => {
      const { data } = await api.post(`/general-invoice-payments/${id}/mark-paid`, { payment_date })
      return data.data as GeneralInvoicePayment
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.payments })
      qc.invalidateQueries({ queryKey: KEYS.paymentDetail(vars.id) })
      qc.invalidateQueries({ queryKey: KEYS.invoices })
    },
  })
}

export const useDeleteGeneralPaymentJournal = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/general-invoice-payments/${id}/journal`)
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEYS.paymentDetail(id) })
      qc.invalidateQueries({ queryKey: KEYS.payments })
    },
  })
}

export const useDeleteGeneralPayment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/general-invoice-payments/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.payments })
      qc.invalidateQueries({ queryKey: KEYS.invoices })
    },
  })
}


// ============================================================
// AMORTIZATION HOOKS
// ============================================================
export interface AmortizationEntry {
  id: string
  amortization_id: string
  period_number: number
  period_date: string
  amount: number
  journal_id: string | null
  executed_at: string | null
  executed_by: string | null
}

export interface AmortizationItem {
  id: string
  company_id: string
  branch_id: string
  invoice_id: string
  invoice_line_id: string
  total_amount: number
  total_periods: number
  amount_per_period: number
  start_date: string
  end_date: string
  prepaid_account_id: string
  prepaid_account_code: string
  prepaid_account_name: string
  expense_account_id: string
  expense_account_code: string
  expense_account_name: string
  periods_executed: number
  last_executed_at: string | null
  status: AmortizationStatus
  invoice_number: string
  vendor_name: string
  entries: AmortizationEntry[]
  next_period_date: string | null
  is_overdue: boolean
}

export const useAmortizations = (params?: {
  branch_id?: string
  status?: AmortizationStatus
  overdue?: boolean
}) =>
  useQuery({
    queryKey: ['general-ap', 'amortizations', params ?? {}],
    queryFn: async () => {
      const { data } = await api.get('/general-invoice-amortizations', { params })
      return data.data as AmortizationItem[]
    },
    staleTime: 30_000,
  })

export const useExecuteAmortization = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, period_number, period_date }: {
      id: string
      period_number: number
      period_date?: string
    }) => {
      const { data } = await api.post(`/general-invoice-amortizations/${id}/execute`, {
        period_number,
        period_date,
      })
      return data.data as { journal_id: string; period_number: number; status: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['general-ap', 'amortizations'] })
      qc.invalidateQueries({ queryKey: KEYS.invoices })
    },
  })
}
