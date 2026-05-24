// ============================================================
// AP Payments — Types
// ============================================================

export type ApPaymentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'RECONCILED'

export type ApPaymentMethod = 'TRANSFER' | 'CASH' | 'CHECK' | 'GIRO'

// ── DB row ────────────────────────────────────────────────────
export interface ApPaymentDB {
  id: string
  company_id: string
  branch_id: string
  payment_number: string
  supplier_id: string
  bank_account_id: number
  supplier_bank_account_id?: number | null
  payment_method: ApPaymentMethod
  total_amount: string        // NUMERIC comes back as string from pg
  payment_date: string | null
  notes: string | null
  rejection_reason: string | null
  status: ApPaymentStatus

  // Bulk payment
  bulk_payment_batch_id: string | null

  // Bukti bayar
  proof_url: string | null
  proof_uploaded_at: string | null
  proof_uploaded_by: string | null

  // Approval audit
  requested_by: string | null
  requested_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  paid_at: string | null
  paid_by: string | null

  // Rekonsiliasi
  bank_statement_id: number | null
  journal_id: string | null
  reconciled_at: string | null
  reconciled_by: string | null

  // Soft delete + audit
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface ApPaymentInvoiceLineDB {
  id: string
  ap_payment_id: string
  purchase_invoice_id: string
  amount_paid: string          // NUMERIC as string
  notes: string | null
  created_at: string
  updated_at: string
}

// ── With relations (for list & detail) ───────────────────────
export interface ApPaymentWithRelations extends ApPaymentDB {
  supplier_name: string
  branch_name: string
  branch_code: string
  bank_account_name: string
  bank_account_number: string
  supplier_bank_account_id?: number | null
  supplier_bank_name?: string | null
  supplier_bank_account_number?: string | null
  supplier_bank_account_name?: string | null
  invoice_count: number
  journal_number?: string | null
  journal_status?: string | null
  // Computed: sudah dibayar dari semua payment PAID/RECONCILED
  // (per-invoice — di detail saja)
}

export interface ApPaymentInvoiceLine extends ApPaymentInvoiceLineDB {
  invoice_number: string
  invoice_date: string
  invoice_due_date: string | null
  invoice_status: string
  invoice_subtotal: number
  invoice_tax: number
  invoice_total_amount: string
  supplier_name: string
  invoice_outstanding: string
  gr_numbers: string | null
}

export interface ApPaymentDetail extends ApPaymentWithRelations {
  lines: ApPaymentInvoiceLine[]
  created_by_name: string | null
  requested_by_name: string | null
  approved_by_name: string | null
  rejected_by_name: string | null
  paid_by_name: string | null
}

// ── Outstanding invoice (untuk selector saat buat payment) ───
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
  total_amount: string
  total_paid: string
  outstanding: string
  is_overdue: boolean
  invoice_status: PurchaseInvoicePayableStatus
  can_pay: boolean
  ap_payment_id: string | null
  ap_payment_number: string | null
}

// ── Dashboard (Sprint 1) ────────────────────────────────────
export type ApAgingBucketKey =
  | 'current'
  | 'days_1_30'
  | 'days_31_60'
  | 'days_61_90'
  | 'days_90_plus'

export interface ApDashboardAgingBucket {
  bucket: ApAgingBucketKey
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

export interface ApDashboardResponse {
  summary: ApDashboardSummary
  aging_totals: ApDashboardAgingBucket[]
  suppliers: ApDashboardSupplierRow[]
  due_date_pivot: ApDueDatePivotGroup[]
}

export interface ApDashboardInvoiceRow {
  id: string
  invoice_number: string
  supplier_id: string
  supplier_name: string
  supplier_code: string | null
  branch_id: string
  branch_name: string
  invoice_status: PurchaseInvoicePayableStatus
  due_date: string | null
  outstanding: number
  is_overdue: boolean
}

// ── DTOs ─────────────────────────────────────────────────────
export interface CreateApPaymentInvoiceLineDto {
  purchase_invoice_id: string
  amount_paid: number
  notes?: string | null
}

export interface CreateApPaymentDto {
  branch_id?: string           // default dari context, bisa override
  supplier_id: string
  bank_account_id: number
  payment_method: ApPaymentMethod
  total_amount: number
  payment_date?: string | null
  notes?: string | null
  lines: CreateApPaymentInvoiceLineDto[]
}

export interface UpdateApPaymentDto {
  bank_account_id?: number
  payment_method?: ApPaymentMethod
  total_amount?: number
  payment_date?: string | null
  notes?: string | null
  lines?: CreateApPaymentInvoiceLineDto[]
}

export interface RejectApPaymentDto {
  rejection_reason: string
}

export interface UploadProofDto {
  proof_url: string
}

export interface ReconcileApPaymentDto {
  bank_statement_id: number
}

// ── List filter ───────────────────────────────────────────────
export interface ApPaymentListFilter {
  company_id: string
  branch_id?: string
  supplier_id?: string
  status?: string
  payment_method?: ApPaymentMethod
  date_from?: string
  date_to?: string
  due_date_from?: string
  due_date_to?: string
  search?: string
  page?: number
  limit?: number
}

// ── Bulk Payment DTOs ─────────────────────────────────────────
export interface BulkCreateApPaymentDto {
  batch_notes?: string | null  // max 500 chars
  payments: Array<{
    supplier_id: string
    bank_account_id: number
    supplier_bank_account_id?: number | null
    payment_method: ApPaymentMethod // default TRANSFER
    invoice_lines: Array<{
      purchase_invoice_id: string
      amount_paid: number
    }>
    notes?: string | null // from supplier group notes
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

// ── Outstanding Invoices ──────────────────────────────────────
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
  earliest_received_date: string | null
  supplier_bank_accounts: Array<{
    id: number
    bank_name: string
    account_number: string
    account_name: string
  }>
  supplier_bank_account_id?: number | null
  assigned_bank_account_id?: number | null
}

export interface OutstandingInvoicesResponse {
  data: OutstandingInvoiceRow[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ── Verify Screenshot (OCR) ───────────────────────────────────
export interface BcaOcrRow {
  va: string
  amount: number
  type: string
  name: string
}

export interface VerifyScreenshotResult {
  ocr_rows: BcaOcrRow[]
  ocr_total: number
  matches: Array<{
    payment_id: string
    payment_number: string
    bank_account_number: string
    system_amount: number
    ocr_amount: number | null
    status: 'match' | 'amount_mismatch' | 'not_found_in_screenshot' | 'not_found_in_system'
  }>
}
