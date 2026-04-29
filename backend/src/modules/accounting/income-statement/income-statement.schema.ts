import { z } from '@/lib/openapi'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const incomeStatementQuerySchema = z.object({
  query: z.object({
    date_from: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}$/),
    branch_ids: z.string().optional().refine(val => {
      if (!val) return true
      return val.split(',').map(s => s.trim()).every(id => UUID_REGEX.test(id))
    }, { message: 'branch_ids harus berisi UUID yang valid' }),
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
