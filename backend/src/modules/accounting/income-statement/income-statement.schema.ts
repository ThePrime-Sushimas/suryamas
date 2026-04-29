import { z } from '@/lib/openapi'

export const incomeStatementQuerySchema = z.object({
  query: z.object({
    date_from: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}$/),
    branch_ids: z.string().optional(),
    compare_date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    compare_date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).refine(d => d.date_from <= d.date_to, {
    message: 'date_from tidak boleh lebih besar dari date_to',
    path: ['date_from'],
  }).refine(d => {
    if (d.compare_date_from && !d.compare_date_to) return false
    if (!d.compare_date_from && d.compare_date_to) return false
    if (d.compare_date_from && d.compare_date_to)
      return d.compare_date_from <= d.compare_date_to
    return true
  }, { message: 'compare period tidak valid', path: ['compare_date_from'] })
})
