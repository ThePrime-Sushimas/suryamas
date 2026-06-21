import { z } from '@/lib/openapi'

export const inventoryReconciliationQuerySchema = z.object({
  query: z.object({
    as_of_date: z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    branch_ids: z.string().optional(), // comma-separated UUIDs
  }),
})
