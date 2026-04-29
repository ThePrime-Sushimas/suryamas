import { z } from '@/lib/openapi'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const balanceSheetQuerySchema = z.object({
  query: z.object({
    as_of_date: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}$/),
    branch_ids: z.string().optional().refine(val => {
      if (!val) return true
      return val.split(',').map(s => s.trim()).every(id => UUID_REGEX.test(id))
    }, { message: 'branch_ids harus berisi UUID yang valid' }),
    compare_as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).refine(d => {
    if (!d.compare_as_of_date) return true
    return d.compare_as_of_date < d.as_of_date
  }, {
    message: 'compare_as_of_date harus lebih kecil dari as_of_date',
    path: ['compare_as_of_date'],
  })
})
