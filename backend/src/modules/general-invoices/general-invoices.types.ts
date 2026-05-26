// ============================================================
// GENERAL AP MODULE — Types
// ============================================================

// ------------------------------------------------------------
// VENDOR
// ------------------------------------------------------------
export type VendorType = 'UTILITY' | 'RENT' | 'SERVICE' | 'SUBSCRIPTION' | 'OTHER'

export interface Vendor {
  id: string
  company_id: string
  vendor_code: string
  vendor_name: string
  vendor_type: VendorType | null
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
  created_by: string | null
}

export interface CreateVendorDto {
  vendor_code: string
  vendor_name: string
  vendor_type?: VendorType
  phone?: string
  email?: string
  address?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_name?: string
  notes?: string
}

export interface UpdateVendorDto extends Partial<CreateVendorDto> {
  is_active?: boolean
}

export interface VendorListFilter {
  company_id: string
  search?: string
  vendor_type?: VendorType
  is_active?: boolean
  page?: number
  limit?: number
}

// ------------------------------------------------------------
// EXPENSE TYPE & STATUS
// ------------------------------------------------------------
export type ExpenseType =
  | 'UTILITY'
  | 'RENT'
  | 'SALARY_SUPPORT'
  | 'SUBSCRIPTION'
  | 'MAINTENANCE'
  | 'OTHER'

export type GeneralInvoiceStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'
export type GeneralPaymentStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'PAID' | 'RECONCILED'
export type RecurrenceType = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

// ------------------------------------------------------------
// GENERAL INVOICE LINE
// ------------------------------------------------------------
export interface GeneralInvoiceLine {
  id: string
  general_invoice_id: string
  line_number: number
  account_id: string
  account_code: string   // joined
  account_name: string   // joined
  description: string | null
  amount: number
  tax_amount: number
  total_amount: number
}

export interface CreateGeneralInvoiceLineDto {
  line_number: number
  account_id: string
  description?: string
  amount: number
  tax_amount?: number
}

// ------------------------------------------------------------
// GENERAL INVOICE (header)
// ------------------------------------------------------------
export interface GeneralInvoice {
  id: string
  company_id: string
  branch_id: string
  invoice_number: string
  vendor_id: string
  vendor_name: string    // joined
  vendor_type: VendorType | null  // joined
  invoice_date: string
  due_date: string | null
  period_start: string | null
  period_end: string | null
  expense_type: ExpenseType
  is_confidential: boolean
  subtotal: number
  total_tax: number
  total_amount: number
  notes: string | null
  attachment_url: string | null
  status: GeneralInvoiceStatus
  journal_id: string | null
  journal_number: string | null  // joined
  template_id: string | null
  posted_by: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  /** Payment aktif (bukan REJECTED) — diisi di list API */
  active_payment?: GeneralInvoicePaymentSummary | null
}

export interface GeneralInvoiceDetail extends GeneralInvoice {
  lines: GeneralInvoiceLine[]
  payment: GeneralInvoicePaymentSummary | null
}

export interface GeneralInvoicePaymentSummary {
  id: string
  payment_number: string
  status: GeneralPaymentStatus
  total_amount: number
  payment_date: string | null
  paid_at: string | null
}

export interface CreateGeneralInvoiceDto {
  branch_id?: string
  vendor_id: string
  invoice_number: string
  invoice_date: string
  due_date?: string
  period_start?: string
  period_end?: string
  expense_type: ExpenseType
  is_confidential?: boolean
  notes?: string
  attachment_url?: string
  template_id?: string
  lines: CreateGeneralInvoiceLineDto[]
}

export interface UpdateGeneralInvoiceDto {
  vendor_id?: string
  invoice_number?: string
  invoice_date?: string
  due_date?: string
  period_start?: string
  period_end?: string
  expense_type?: ExpenseType
  is_confidential?: boolean
  notes?: string
  attachment_url?: string
  lines?: CreateGeneralInvoiceLineDto[]
}

export interface GeneralInvoiceListFilter {
  company_id: string
  branch_id?: string
  branch_ids?: string[]
  status?: GeneralInvoiceStatus
  expense_type?: ExpenseType
  vendor_id?: string
  due_date_from?: string
  due_date_to?: string
  invoice_date_from?: string
  invoice_date_to?: string
  search?: string
  overdue?: boolean
  include_confidential?: boolean   // default false kecuali punya permission
  page?: number
  limit?: number
}

// ------------------------------------------------------------
// GENERAL INVOICE PAYMENT
// ------------------------------------------------------------
export interface GeneralInvoicePayment {
  id: string
  company_id: string
  branch_id: string
  payment_number: string
  general_invoice_id: string
  invoice_number: string    // joined
  vendor_name: string       // joined
  bank_account_id: number
  bank_account_name: string | null  // joined
  payment_method: 'TRANSFER' | 'CASH'
  total_amount: number
  payment_date: string | null
  notes: string | null
  proof_url: string | null
  proof_uploaded_at: string | null
  status: GeneralPaymentStatus
  rejection_reason: string | null
  requested_by: string | null
  approved_by: string | null
  approved_at: string | null
  paid_by: string | null
  paid_at: string | null
  journal_id: string | null
  journal_number: string | null  // joined
  reconciled_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateGeneralInvoicePaymentDto {
  branch_id?: string
  general_invoice_id: string
  bank_account_id: number
  payment_method?: 'TRANSFER' | 'CASH'
  total_amount: number
  payment_date?: string
  notes?: string
}

export interface GeneralPaymentListFilter {
  company_id: string
  branch_id?: string
  branch_ids?: string[]
  status?: GeneralPaymentStatus
  vendor_id?: string
  payment_date_from?: string
  payment_date_to?: string
  search?: string
  include_confidential?: boolean
  page?: number
  limit?: number
}

// ------------------------------------------------------------
// GENERAL INVOICE TEMPLATE
// ------------------------------------------------------------
export interface GeneralInvoiceTemplateLine {
  id: string
  template_id: string
  line_number: number
  account_id: string
  account_code: string   // joined
  account_name: string   // joined
  description: string | null
  amount_ratio: number | null
}

export interface GeneralInvoiceTemplate {
  id: string
  company_id: string
  branch_id: string
  template_name: string
  vendor_id: string
  vendor_name: string    // joined
  expense_type: ExpenseType
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

export interface CreateGeneralInvoiceTemplateDto {
  branch_id?: string
  template_name: string
  vendor_id: string
  expense_type: ExpenseType
  is_confidential?: boolean
  recurrence: RecurrenceType
  default_amount?: number
  due_date_offset_days?: number
  notes?: string
  lines: Array<{
    line_number: number
    account_id: string
    description?: string
    amount_ratio?: number
  }>
}

export interface GenerateFromTemplateDto {
  template_id: string
  invoice_date: string
  invoice_number: string
  // Override nominal per line jika perlu (listrik — nominal berubah tiap bulan)
  line_amounts?: Array<{
    line_number: number
    amount: number
    tax_amount?: number
  }>
  notes?: string
}

// ------------------------------------------------------------
// DASHBOARD
// ------------------------------------------------------------
export interface GeneralApDashboardSummary {
  total_unpaid: number
  total_unpaid_count: number
  overdue_amount: number
  overdue_count: number
  due_this_week: number
  due_this_week_count: number
  draft_count: number
  posted_count: number
}

export interface GeneralApDashboardByType {
  expense_type: ExpenseType
  total_amount: number
  invoice_count: number
  unpaid_amount: number
}

export interface GeneralApDashboard {
  summary: GeneralApDashboardSummary
  by_expense_type: GeneralApDashboardByType[]
}

// ------------------------------------------------------------
// EXPENSE TYPE → DEFAULT COA
// ------------------------------------------------------------
export interface ExpenseCoaDefault {
  expense_type: ExpenseType
  account_id: string
  account_code: string
  account_name: string
}

export interface UpsertExpenseCoaDefaultsDto {
  defaults: Array<{
    expense_type: ExpenseType
    account_id: string | null
  }>
}
