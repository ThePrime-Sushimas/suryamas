import { z } from '@/lib/openapi'

const wasteSources = ['GOODS_PROCESSING', 'STOCK_ADJUSTMENT', 'PRODUCTION_ORDER', 'DAILY_OPNAME'] as const

export const wasteReportQuerySchema = z.object({
  query: z.object({
    branch_id: z.string().uuid().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    item_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    source: z.enum(wasteSources).optional(),
  }).refine(
    (d) => d.start_date <= d.end_date,
    { message: 'start_date must be <= end_date' },
  ),
})

export const wasteReportByBranchSchema = z.object({
  query: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
    category_id: z.string().uuid().optional(),
    source: z.enum(wasteSources).optional(),
  }).refine(
    (d) => d.start_date <= d.end_date,
    { message: 'start_date must be <= end_date' },
  ),
})

export const wasteReportCompareSchema = z.object({
  query: z.object({
    branch_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    source: z.enum(wasteSources).optional(),
    period_a_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_a_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_b_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_b_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).refine(
    (d) => d.period_a_start <= d.period_a_end && d.period_b_start <= d.period_b_end,
    { message: 'start must be <= end for both periods' },
  ),
})
