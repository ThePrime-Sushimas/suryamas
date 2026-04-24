import { z } from '@/lib/openapi'

export const feeDiscrepancyListSchema = z.object({
  query: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'CORRECTED']).optional(),
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
