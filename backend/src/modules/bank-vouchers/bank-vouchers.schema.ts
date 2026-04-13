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
    transaction_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, 'At least one date required'),
    branch_id: uuidSchema.optional(),
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
// PHASE 2: POST /opening-balance (placeholder)
// ============================================================

export const bankVoucherOpeningBalanceSchema = z.object({
  body: z.object({
    bank_account_id: bankAccountIdSchema,
    period_month: periodMonthSchema,
    period_year: periodYearSchema,
    opening_balance: z.number().finite().min(0),
  }),
})

export type BankVoucherOpeningBalanceRequest = z.infer<typeof bankVoucherOpeningBalanceSchema>['body']

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
