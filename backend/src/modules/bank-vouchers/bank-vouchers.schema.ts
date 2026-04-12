import { z } from 'zod'

const currentYear = new Date().getFullYear()

// ============================================
// SHARED
// ============================================

const periodMonthSchema = z
  .string()
  .regex(/^\d{1,2}$/, 'period_month must be a number')
  .transform(Number)
  .refine((v) => v >= 1 && v <= 12, 'period_month must be between 1 and 12')

const periodYearSchema = z
  .string()
  .regex(/^\d{4}$/, 'period_year must be a 4-digit year')
  .transform(Number)
  .refine((v) => v >= 2020 && v <= currentYear + 1, `period_year must be between 2020 and ${currentYear + 1}`)

// ============================================
// GET /preview
// ============================================

export const bankVoucherPreviewSchema = z.object({
  query: z.object({
    period_month: periodMonthSchema,
    period_year: periodYearSchema,
    branch_id: z.string().uuid('branch_id must be a valid UUID').optional(),
    bank_account_id: z
      .string()
      .regex(/^\d+$/, 'bank_account_id must be a number')
      .transform(Number)
      .optional(),
    voucher_type: z.enum(['BM', 'BK']).optional(),
  }),
})

export type BankVoucherPreviewQuery = z.infer<typeof bankVoucherPreviewSchema>['query']

// ============================================
// GET /summary
// ============================================

export const bankVoucherSummarySchema = z.object({
  query: z.object({
    period_month: periodMonthSchema,
    period_year: periodYearSchema,
    branch_id: z.string().uuid('branch_id must be a valid UUID').optional(),
  }),
})

export type BankVoucherSummaryQuery = z.infer<typeof bankVoucherSummarySchema>['query']
