import { z } from '@/lib/openapi'

export const cogsPreviewSchema = z.object({
  body: z.object({
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    branch_id: z.string().uuid().nullable().optional(),
  }),
})

export const cogsFinalizeSchema = z.object({
  body: z.object({
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    branch_id: z.string().uuid().nullable().optional(),
    journal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().max(500).nullable().optional(),
  }),
})

export const cogsIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const cogsListSchema = z.object({
  query: z.object({
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    branch_id: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'JOURNALED', 'VOID']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }),
})
