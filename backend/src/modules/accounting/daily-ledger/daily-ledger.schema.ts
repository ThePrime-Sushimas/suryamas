import { z } from '@/lib/openapi'

export const dailyLedgerQuerySchema = z.object({
  query: z.object({
    date_from: z.string().min(10),
    date_to: z.string().min(10),
    branch_ids: z.string().optional(), // comma-separated
    account_types: z.string().optional(), // comma-separated: ASSET,LIABILITY,EQUITY,REVENUE,EXPENSE
  }),
})
