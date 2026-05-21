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
  payment_method: ApPaymentMethod
  total_amount: string        // NUMERIC comes back as string from pg
  payment_date: string | null
  notes: string | null
  rejection_reason: string | null
  status: ApPaymentStatus

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
  invoice_count: number
  // Computed: sudah dibayar dari semua payment PAID/RECONCILED
  // (per-invoice — di detail saja)
}

export interface ApPaymentInvoiceLine extends ApPaymentInvoiceLineDB {
  invoice_number: string
  invoice_date: string
  invoice_total_amount: string
  supplier_name: string
  // Computed outstanding sebelum payment ini
  invoice_outstanding: string
}

export interface ApPaymentDetail extends ApPaymentWithRelations {
  lines: ApPaymentInvoiceLine[]
}

// ── Outstanding invoice (untuk selector saat buat payment) ───
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
  total_paid: string           // SUM dari PAID+RECONCILED payments
  outstanding: string          // total_amount - total_paid
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
  status?: ApPaymentStatus
  payment_method?: ApPaymentMethod
  date_from?: string
  date_to?: string
  search?: string              // payment_number
  page?: number
  limit?: number
}
