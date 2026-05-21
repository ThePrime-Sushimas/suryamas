import { z } from '@/lib/openapi'

const paymentMethods = ['TRANSFER', 'CASH', 'CHECK', 'GIRO'] as const
const paymentStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID', 'RECONCILED'] as const

// ── Invoice line ──────────────────────────────────────────────
const invoiceLineSchema = z.object({
  purchase_invoice_id: z.string().uuid(),
  amount_paid: z.number().positive(),
  notes: z.string().max(500).nullable().optional(),
})

// ── Create ────────────────────────────────────────────────────
export const createApPaymentSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid().optional(),
    supplier_id: z.string().uuid(),
    bank_account_id: z.number().int().positive(),
    payment_method: z.enum(paymentMethods),
    total_amount: z.number().positive(),
    payment_date: z.string().date().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    lines: z.array(invoiceLineSchema).min(1, 'At least one invoice line is required'),
  }),
})

// ── Update (DRAFT only) ───────────────────────────────────────
export const updateApPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    bank_account_id: z.number().int().positive().optional(),
    payment_method: z.enum(paymentMethods).optional(),
    total_amount: z.number().positive().optional(),
    payment_date: z.string().date().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    lines: z.array(invoiceLineSchema).min(1).optional(),
  }),
})

// ── Reject ────────────────────────────────────────────────────
export const rejectApPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    rejection_reason: z.string().min(1).max(500),
  }),
})

// ── Upload proof (multipart file; params only) ────────────────
export const uploadProofSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

// ── Reconcile ─────────────────────────────────────────────────
export const reconcileApPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    bank_statement_id: z.number().int().positive(),
  }),
})

// ── List filter ───────────────────────────────────────────────
export const listApPaymentsSchema = z.object({
  query: z.object({
    branch_id:      z.string().uuid().optional(),
    supplier_id:    z.string().uuid().optional(),
    status:         z.enum(paymentStatuses).optional(),
    payment_method: z.enum(paymentMethods).optional(),
    date_from:      z.string().date().optional(),
    date_to:        z.string().date().optional(),
    search:         z.string().optional(),
    page:           z.coerce.number().int().positive().default(1),
    limit:          z.coerce.number().int().positive().max(100).default(20),
  }),
})

// ── Dashboard ─────────────────────────────────────────────────
export const apDashboardSchema = z.object({
  query: z.object({
    branch_id: z.string().uuid().optional(),
  }),
})

// ── Outstanding invoices filter ───────────────────────────────
export const outstandingInvoicesSchema = z.object({
  query: z.object({
    supplier_id: z.string().uuid().optional(),
    branch_id:   z.string().uuid().optional(),
    overdue_only: z.coerce.boolean().optional(),
  }),
})

// ── Param only ────────────────────────────────────────────────
export const apPaymentParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})
