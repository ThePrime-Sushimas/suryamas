import { z } from '@/lib/openapi'

export const generalLedgerQuerySchema = z.object({
  query: z.object({
    account_id: z.string().optional(),        // single UUID (backward compat)
    account_ids: z.string().optional(),       // comma-separated UUIDs for multi-select
    date_from: z.string().min(10),
    date_to: z.string().min(10),
    branch_ids: z.string().optional(),        // comma-separated
    search: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }).refine(
    (data) => !!(data.account_id || data.account_ids),
    { message: 'account_id atau account_ids wajib diisi' }
  ),
})
