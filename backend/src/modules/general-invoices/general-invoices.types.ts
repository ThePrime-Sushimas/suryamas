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
  created_by: string | null
}

export interface CreateVendorDto {
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
}

export interface UpdateVendorDto extends Partial<CreateVendorDto> {
  is_active?: boolean
}

export interface VendorListFilter {
  company_ids: string[]
  search?: string
  vendor_type?: VendorType
  is_active?: boolean
  sort_by?: 'vendor_name' | 'vendor_code' | 'created_at'
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// ------------------------------------------------------------
// TRANSACTION TYPE & STATUS
// ------------------------------------------------------------
export type TransactionType = 'EXPENSE' | 'PREPAID'

export type GeneralInvoiceStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'
export type GeneralPaymentStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'PAID' | 'RECONCILED'
export type RecurrenceType = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type AmortizationStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

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
  tax_account_id: string | null        // COA for tax (e.g. PPN Masukan). If NULL, tax bundled into main account.
  tax_account_code: string | null      // joined
  tax_account_name: string | null      // joined
  total_amount: number
  transaction_type: TransactionType
  expense_account_id: string | null    // COA 6xxx for PREPAID amortization
  expense_account_code: string | null  // joined
  expense_account_name: string | null  // joined
  total_periods: number | null
  amortization_start_date: string | null
}

export interface CreateGeneralInvoiceLineDto {
  line_number: number
  account_id: string
  description?: string
  amount: number
  tax_amount?: number
  tax_account_id?: string             // COA for tax. If omitted, tax bundled into main account.
  transaction_type?: TransactionType  // default EXPENSE
  expense_account_id?: string         // required if PREPAID
  total_periods?: number              // required if PREPAID
  amortization_start_date?: string    // required if PREPAID
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
  /** Whether this invoice has PREPAID lines with active amortization */
  has_amortization?: boolean
}

export interface GeneralInvoiceDetail extends GeneralInvoice {
  lines: GeneralInvoiceLine[]
  payment: GeneralInvoicePaymentSummary | null
  amortizations?: AmortizationSummary[]
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
  invoice_number?: string
  invoice_date: string
  due_date?: string
  period_start?: string
  period_end?: string
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
  is_confidential?: boolean
  notes?: string
  attachment_url?: string
  lines?: CreateGeneralInvoiceLineDto[]
}

export interface GeneralInvoiceListFilter {
  branch_id?: string
  branch_ids: string[]
  status?: GeneralInvoiceStatus
  vendor_id?: string
  due_date_from?: string
  due_date_to?: string
  invoice_date_from?: string
  invoice_date_to?: string
  search?: string
  overdue?: boolean
  include_confidential?: boolean
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
  branch_id?: string
  branch_ids: string[]
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
  transaction_type: TransactionType
  tax_account_id: string | null
  tax_account_code: string | null  // joined
  tax_account_name: string | null  // joined
  expense_account_id: string | null
  expense_account_code: string | null  // joined
  expense_account_name: string | null  // joined
  total_periods: number | null
  amortization_start_offset_days: number | null
}

export interface GeneralInvoiceTemplate {
  id: string
  company_id: string
  branch_id: string
  template_name: string
  vendor_id: string
  vendor_name: string    // joined
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
    transaction_type?: TransactionType
    tax_account_id?: string
    expense_account_id?: string
    total_periods?: number
    amortization_start_offset_days?: number
  }>
}

export interface GenerateFromTemplateDto {
  template_id: string
  invoice_date: string
  invoice_number?: string
  // Override nominal per line jika perlu (listrik — nominal berubah tiap bulan)
  line_amounts?: Array<{
    line_number: number
    amount: number
    tax_amount?: number
  }>
  notes?: string
}

// ------------------------------------------------------------
// AMORTIZATION
// ------------------------------------------------------------
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

export interface AmortizationSummary {
  id: string
  invoice_line_id: string
  total_amount: number
  total_periods: number
  amount_per_period: number
  start_date: string
  end_date: string
  prepaid_account_id: string
  prepaid_account_code: string   // joined
  prepaid_account_name: string   // joined
  expense_account_id: string
  expense_account_code: string   // joined
  expense_account_name: string   // joined
  periods_executed: number
  last_executed_at: string | null
  status: AmortizationStatus
  entries: AmortizationEntry[]
  // Computed
  next_period_date: string | null
  is_overdue: boolean
}

export interface ExecuteAmortizationDto {
  amortization_id: string
  period_number: number
  period_date?: string  // default: entry's period_date
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

export interface GeneralApDashboard {
  summary: GeneralApDashboardSummary
  pending_amortizations: number  // count of overdue amortization entries
}
