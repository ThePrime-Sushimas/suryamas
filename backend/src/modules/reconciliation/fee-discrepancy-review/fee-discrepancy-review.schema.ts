import { z } from '@/lib/openapi'

export const feeDiscrepancyListSchema = z.object({
  query: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'CORRECTED', 'DISMISSED']).optional(),
    paymentMethodId: z.coerce.number().optional(),
    minAmount: z.coerce.number().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(50),
  }),
})

export const feeDiscrepancySummarySchema = z.object({
  query: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }),
})

export const feeDiscrepancyUpdateStatusSchema = z.object({
  params: z.object({
    source: z.enum(['SINGLE_MATCH', 'MULTI_MATCH', 'SETTLEMENT_GROUP']),
    sourceId: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['CONFIRMED', 'CORRECTED', 'DISMISSED']),
    notes: z.string().optional(),
    correctionJournalId: z.string().uuid().optional(),
  }),
})

export const feeDiscrepancyCreateCorrectionSchema = z.object({
  params: z.object({
    source: z.enum(['SINGLE_MATCH', 'MULTI_MATCH', 'SETTLEMENT_GROUP']),
    sourceId: z.string().uuid(),
  }),
  body: z.object({
    lines: z.array(z.object({
      correctionType: z.enum(['POS_PENDING', 'REFUND_CUSTOMER', 'PLATFORM_COMPENSATION', 'ROUNDING', 'STAFF_DEDUCTION']),
      amount: z.number().positive(),
    })).min(1),
    notes: z.string().optional(),
  }),
})
