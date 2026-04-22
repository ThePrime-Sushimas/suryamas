import { z } from '@/lib/openapi'

export const trialBalanceQuerySchema = z.object({
  query: z.object({
    date_from: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}$/),
    branch_ids: z.string().optional(), // comma-separated UUIDs
  }).refine(d => d.date_from <= d.date_to, {
    message: 'date_from tidak boleh lebih besar dari date_to',
    path: ['date_from'],
  })
})
