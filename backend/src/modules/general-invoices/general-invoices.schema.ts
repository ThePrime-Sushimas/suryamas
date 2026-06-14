import { z } from '@/lib/openapi'

const vendorTypes  = ['UTILITY', 'RENT', 'SERVICE', 'SUBSCRIPTION', 'OTHER'] as const
const transactionTypes = ['EXPENSE', 'PREPAID'] as const
const paymentMethods = ['TRANSFER', 'CASH', 'CC_OWNER'] as const
const recurrenceTypes = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const

// ============================================================
// VENDOR
// ============================================================
export const createVendorSchema = z.object({
  body: z.object({
    vendor_code:         z.string().min(1).max(30),
    vendor_name:         z.string().min(1).max(255),
    vendor_type:         z.enum(vendorTypes).optional(),
    contact_person:      z.string().max(150).nullable().optional(),
    phone:               z.string().max(30).nullable().optional(),
    email:               z.string().email().max(150).nullable().optional(),
    address:             z.string().max(500).nullable().optional(),
    bank_name:           z.string().max(100).nullable().optional(),
    bank_account_number: z.string().max(50).nullable().optional(),
    bank_account_name:   z.string().max(150).nullable().optional(),
    notes:               z.string().max(1000).nullable().optional(),
  }),
})

export const updateVendorSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    vendor_code:         z.string().min(1).max(30).optional(),
    vendor_name:         z.string().min(1).max(255).optional(),
    vendor_type:         z.enum(vendorTypes).nullable().optional(),
    contact_person:      z.string().max(150).nullable().optional(),
    phone:               z.string().max(30).nullable().optional(),
    email:               z.string().email().max(150).nullable().optional(),
    address:             z.string().max(500).nullable().optional(),
    bank_name:           z.string().max(100).nullable().optional(),
    bank_account_number: z.string().max(50).nullable().optional(),
    bank_account_name:   z.string().max(150).nullable().optional(),
    notes:               z.string().max(1000).nullable().optional(),
    is_active:           z.boolean().optional(),
  }),
})

export const listVendorsSchema = z.object({
  query: z.object({
    search:      z.string().max(100).optional(),
    vendor_type: z.preprocess((v) => (v === '' ? undefined : v), z.enum(vendorTypes).optional()),
    is_active:   z.preprocess((v) => {
      if (v === 'true')  return true
      if (v === 'false') return false
      return undefined
    }, z.boolean().optional()),
    sort_by:    z.preprocess((v) => (v === '' ? undefined : v), z.enum(['vendor_name', 'vendor_code', 'created_at']).optional()),
    sort_order: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['asc', 'desc']).optional()),
    page:  z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
  }),
})

export const vendorParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

// ============================================================
// GENERAL INVOICE LINE (shared)
// ============================================================
const invoiceLineSchema = z.object({
  line_number:             z.number().int().positive(),
  account_id:              z.string().uuid(),
  description:             z.string().max(500).nullable().optional(),
  amount:                  z.number().nonnegative(),
  tax_amount:              z.number().nonnegative().default(0),
  tax_account_id:          z.string().uuid().nullable().optional(),  // COA for tax (PPN Masukan etc.)
  transaction_type:        z.enum(transactionTypes).default('EXPENSE'),
  expense_account_id:      z.string().uuid().optional(),       // required if PREPAID
  total_periods:           z.number().int().positive().optional(),  // required if PREPAID
  amortization_start_date: z.string().date().optional(),       // required if PREPAID
}).refine(
  (line) => {
    if (line.transaction_type === 'PREPAID') {
      return !!line.expense_account_id && !!line.total_periods && !!line.amortization_start_date
    }
    return true
  },
  { message: 'PREPAID lines require expense_account_id, total_periods, and amortization_start_date' },
)

// ============================================================
// GENERAL INVOICE
// ============================================================
export const createGeneralInvoiceSchema = z.object({
  body: z.object({
    branch_id:       z.string().uuid().optional(),
    vendor_id:       z.string().uuid(),
    invoice_number:  z.string().min(1).max(100).optional(),
    invoice_date:    z.string().date(),
    due_date:        z.string().date().nullable().optional(),
    period_start:    z.string().date().nullable().optional(),
    period_end:      z.string().date().nullable().optional(),
    is_confidential: z.boolean().default(false),
    notes:           z.string().max(1000).nullable().optional(),
    attachment_url:  z.string().max(500).nullable().optional(),
    template_id:     z.string().uuid().nullable().optional(),
    lines:           z.array(invoiceLineSchema).min(1, 'Minimal 1 baris diperlukan'),
  }),
})

export const updateGeneralInvoiceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    vendor_id:       z.string().uuid().optional(),
    invoice_number:  z.string().min(1).max(100).optional(),
    invoice_date:    z.string().date().optional(),
    due_date:        z.string().date().nullable().optional(),
    period_start:    z.string().date().nullable().optional(),
    period_end:      z.string().date().nullable().optional(),
    is_confidential: z.boolean().optional(),
    notes:           z.string().max(1000).nullable().optional(),
    attachment_url:  z.string().url().nullable().optional(),
    lines:           z.array(invoiceLineSchema).min(1).optional(),
  }),
})

export const listGeneralInvoicesSchema = z.object({
  query: z.object({
    branch_id:          z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
    vendor_id:          z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
    status:             z.preprocess((v) => (v === '' ? undefined : v), z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional()),
    due_date_from:      z.preprocess((v) => (v === '' ? undefined : v), z.string().date().optional()),
    due_date_to:        z.preprocess((v) => (v === '' ? undefined : v), z.string().date().optional()),
    invoice_date_from:  z.preprocess((v) => (v === '' ? undefined : v), z.string().date().optional()),
    invoice_date_to:    z.preprocess((v) => (v === '' ? undefined : v), z.string().date().optional()),
    search:             z.string().max(100).optional(),
    overdue:            z.preprocess((v) => v === 'true' || v === '1', z.boolean().optional()),
    page:               z.coerce.number().int().positive().default(1),
    limit:              z.coerce.number().int().positive().max(200).default(20),
  }),
})

export const generalInvoiceParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const generalInvoiceDashboardSchema = z.object({
  query: z.object({
    branch_id: z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
  }),
})

// ============================================================
// GENERAL INVOICE PAYMENT
// ============================================================
export const createGeneralInvoicePaymentSchema = z.object({
  body: z.object({
    branch_id:              z.string().uuid().optional(),
    general_invoice_id:     z.string().uuid(),
    bank_account_id:        z.number().int().positive().nullable().optional(),
    owner_credit_card_id:   z.string().uuid().nullable().optional(),
    payment_method:         z.enum(paymentMethods).default('TRANSFER'),
    total_amount:           z.number().positive(),
    payment_date:           z.string().date().nullable().optional(),
    notes:                  z.string().max(1000).nullable().optional(),
  }).refine(
    (data) => {
      if (data.payment_method === 'CC_OWNER') {
        return !!data.owner_credit_card_id
      }
      return !!data.bank_account_id
    },
    { message: 'CC_OWNER requires owner_credit_card_id, TRANSFER/CASH requires bank_account_id' },
  ),
})

export const rejectGeneralPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    reason: z.string().min(1).max(500),
  }),
})

export const markPaidGeneralPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    payment_date: z.string().date().optional(),
  }),
})

export const uploadProofGeneralPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    proof_url: z.string().max(500).min(1).optional(),
  }),
})

export const listGeneralPaymentsSchema = z.object({
  query: z.object({
    branch_id:          z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
    vendor_id:          z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
    status:             z.preprocess((v) => (v === '' ? undefined : v),
                          z.enum(['DRAFT', 'APPROVED', 'REJECTED', 'PAID', 'RECONCILED']).optional()),
    payment_date_from:  z.preprocess((v) => (v === '' ? undefined : v), z.string().date().optional()),
    payment_date_to:    z.preprocess((v) => (v === '' ? undefined : v), z.string().date().optional()),
    search:             z.string().max(100).optional(),
    page:               z.coerce.number().int().positive().default(1),
    limit:              z.coerce.number().int().min(-1).max(100000).default(20),
  }),
})

export const generalPaymentParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

// ============================================================
// GENERAL INVOICE TEMPLATE
// ============================================================
const templateLineSchema = z.object({
  line_number:                    z.number().int().positive(),
  account_id:                     z.string().uuid(),
  description:                    z.string().max(500).nullable().optional(),
  amount_ratio:                   z.number().min(0).max(1).nullable().optional(),
  transaction_type:               z.enum(transactionTypes).default('EXPENSE'),
  tax_account_id:                 z.string().uuid().nullable().optional(),
  expense_account_id:             z.string().uuid().optional(),
  total_periods:                  z.number().int().positive().optional(),
  amortization_start_offset_days: z.number().int().nonnegative().optional(),
}).refine(
  (line) => {
    if (line.transaction_type === 'PREPAID') {
      return !!line.expense_account_id && !!line.total_periods
    }
    return true
  },
  { message: 'PREPAID template lines require expense_account_id and total_periods' },
)

export const createGeneralInvoiceTemplateSchema = z.object({
  body: z.object({
    branch_id:                      z.string().uuid().optional(),
    template_name:                  z.string().min(1).max(255),
    vendor_id:                      z.string().uuid(),
    is_confidential:                z.boolean().default(false),
    recurrence:                     z.enum(recurrenceTypes),
    default_amount:                 z.number().positive().nullable().optional(),
    due_date_offset_days:           z.number().int().nonnegative().default(14),
    notes:                          z.string().max(1000).nullable().optional(),
    preferred_vendor_bank_account_id: z.number().int().positive().nullable().optional(),
    lines:                          z.array(templateLineSchema).min(1, 'Minimal 1 baris diperlukan'),
  }),
})

export const updateGeneralInvoiceTemplateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    preferred_vendor_bank_account_id: z.number().int().positive().nullable(),
  }),
})

export const generateFromTemplateSchema = z.object({
  body: z.object({
    template_id:     z.string().uuid(),
    invoice_date:    z.string().date(),
    invoice_number:  z.string().min(1).max(100).optional(),
    line_amounts: z.array(z.object({
      line_number: z.number().int().positive(),
      amount:      z.number().nonnegative(),
      tax_amount:  z.number().nonnegative().optional(),
    })).optional(),
    notes: z.string().max(1000).nullable().optional(),
  }),
})

export const generalTemplateParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

// ============================================================
// AMORTIZATION
// ============================================================
export const executeAmortizationSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    period_number: z.number().int().positive(),
    period_date:   z.string().date().optional(),
  }),
})

export const listAmortizationsSchema = z.object({
  query: z.object({
    branch_id: z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
    status:    z.preprocess((v) => (v === '' ? undefined : v), z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional()),
    overdue:   z.preprocess((v) => v === 'true' || v === '1', z.boolean().optional()),
    page:      z.coerce.number().int().positive().default(1),
    limit:     z.coerce.number().int().positive().max(200).default(20),
  }),
})
