import { z } from '@/lib/openapi'

export const theoreticalConsumptionQuerySchema = z.object({
  query: z.object({
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    branch_id: z.string().uuid().optional(),
  }).refine(
    (d) => d.period_start <= d.period_end,
    { message: 'period_start must be <= period_end' }
  ),
})
