import { z } from 'zod'

const currentYear = new Date().getFullYear()

// ============================================================
// SHARED SCHEMAS
// ============================================================

export const periodMonthSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
  .refine((v) => Number.isInteger(v) && v >= 1 && v <= 12, {
    message: 'period_month must be an integer between 1 and 12',
  })

export const periodYearSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
  .refine((v) => Number.isInteger(v) && v >= 2020 && v <= currentYear + 1, {
    message: `period_year must be an integer between 2020 and ${currentYear + 1}`,
  })

export const bankAccountIdSchema = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? parseInt(v, 10) : v))
  .refine((v) => Number.isInteger(v) && v > 0, {
    message: 'bank_account_id must be a positive integer',
  })

export const uuidSchema = z.string().uuid('Must be a valid UUID')

export const voucherTypeSchema = z.enum(['BM', 'BK'])

// ============================================================
// GET /preview
// Sesuai pattern validateSchema dari companies — { query: z.object({}) }
// ============================================================

export const bankVoucherPreviewSchema = z.object({
  query: z.object({
    period_month: periodMonthSchema,
    period_year: periodYearSchema,
    branch_id: uuidSchema.optional(),
    bank_account_id: bankAccountIdSchema.optional(),
    voucher_type: voucherTypeSchema.optional(),
  }),
})

export type BankVoucherPreviewQuery = z.infer<typeof bankVoucherPreviewSchema>['query']

// ============================================================
// GET /summary
// ============================================================

export const bankVoucherSummarySchema = z.object({
  query: z.object({
    period_month: periodMonthSchema,
    period_year: periodYearSchema,
    branch_id: uuidSchema.optional(),
  }),
})

export type BankVoucherSummaryQuery = z.infer<typeof bankVoucherSummarySchema>['query']

// ============================================================
// PHASE 2: POST /confirm (placeholder)
// ============================================================

export const bankVoucherConfirmSchema = z.object({
  body: z.object({
    voucher_ids: z.array(uuidSchema).min(1, 'At least one voucher ID required'),
  }),
})

export type BankVoucherConfirmRequest = z.infer<typeof bankVoucherConfirmSchema>['body']

// ============================================================
// PHASE 2: PUT /:id/adjust (placeholder)
// ============================================================

export const bankVoucherAdjustSchema = z.object({
  body: z.object({
    lines: z.array(
      z.object({
        line_number: z.number().int().positive(),
        description: z.string().optional(),
        amount: z.number().finite().optional(),
        note: z.string().optional(),
      })
    ).min(1),
  }),
})

export type BankVoucherAdjustRequest = z.infer<typeof bankVoucherAdjustSchema>['body']

// ============================================================
// POST /opening-balance
// ============================================================

export const bankVoucherOpeningBalanceSchema = z.object({
  body: z.object({
    bank_account_id: bankAccountIdSchema,
    period_month: periodMonthSchema,
    period_year: periodYearSchema,
    opening_balance: z.number().finite(),
  }),
})

export type BankVoucherOpeningBalanceRequest = z.infer<typeof bankVoucherOpeningBalanceSchema>['body']

// ============================================================
// GET /opening-balance
// ============================================================

export const bankVoucherGetOpeningBalanceSchema = z.object({
  query: z.object({
    bank_account_id: bankAccountIdSchema,
    period_month: periodMonthSchema,
    period_year: periodYearSchema,
  }),
})

export type BankVoucherGetOpeningBalanceQuery = z.infer<typeof bankVoucherGetOpeningBalanceSchema>['query']

// ============================================================
// POST /manual — create manual voucher
// ============================================================

const manualLineSchema = z.object({
  description: z.string().min(1, 'Description required'),
  bank_account_id: bankAccountIdSchema,
  bank_account_name: z.string().min(1),
  bank_account_number: z.string().optional(),
  payment_method_id: z.number().int().positive().optional(),
  payment_method_name: z.string().optional(),
  is_fee_line: z.boolean().default(false),
  gross_amount: z.number().finite().default(0),
  tax_amount: z.number().finite().default(0),
  actual_fee_amount: z.number().finite().default(0),
  nett_amount: z.number().finite(),
  coa_account_id: uuidSchema.optional(),
  fee_coa_account_id: uuidSchema.optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const bankVoucherManualCreateSchema = z.object({
  body: z.object({
    voucher_type: voucherTypeSchema,
    bank_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'bank_date must be YYYY-MM-DD'),
    bank_account_id: bankAccountIdSchema,
    branch_id: uuidSchema.optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    lines: z.array(manualLineSchema).min(1, 'At least one line required'),
  }),
})

export type BankVoucherManualCreateRequest = z.infer<typeof bankVoucherManualCreateSchema>['body']

// ============================================================
// DELETE /:id/void — void voucher
// ============================================================

export const bankVoucherVoidSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Void reason is required'),
  }),
})

export type BankVoucherVoidRequest = z.infer<typeof bankVoucherVoidSchema>['body']

// ============================================================
// GET /list — list confirmed vouchers
// ============================================================

export const bankVoucherListSchema = z.object({
  query: z.object({
    period_month: periodMonthSchema,
    period_year: periodYearSchema,
    branch_id: uuidSchema.optional(),
    bank_account_id: bankAccountIdSchema.optional(),
    status: z.enum(['DRAFT', 'CONFIRMED', 'JOURNALED', 'VOID']).optional(),
  }),
})

export type BankVoucherListQuery = z.infer<typeof bankVoucherListSchema>['query']

// ============================================================
// HELPERS
// ============================================================

export function validatePeriodParams(month: unknown, year: unknown): {
  period_month: number
  period_year: number
} {
  return z.object({
    period_month: periodMonthSchema,
    period_year: periodYearSchema,
  }).parse({ period_month: month, period_year: year })
}

export function safeValidatePeriod(month: unknown, year: unknown): {
  success: boolean
  data?: { period_month: number; period_year: number }
  error?: string
} {
  try {
    const data = validatePeriodParams(month, year)
    return { success: true, data }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid period'
    return { success: false, error: message }
  }
}

export function validateUUID(value: unknown): string {
  return uuidSchema.parse(value)
}
