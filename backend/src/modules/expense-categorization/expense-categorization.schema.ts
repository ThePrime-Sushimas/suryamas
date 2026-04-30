import { z } from '@/lib/openapi'

export const createRuleSchema = z.object({
  body: z.object({
    purpose_id: z.string().uuid(),
    pattern: z.string().min(2).max(200),
    match_type: z.enum(['CONTAINS', 'STARTS_WITH', 'EXACT', 'REGEX']).default('CONTAINS'),
    priority: z.number().int().min(1).max(9999).default(100),
  }),
})

export const updateRuleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    purpose_id: z.string().uuid().optional(),
    pattern: z.string().min(2).max(200).optional(),
    match_type: z.enum(['CONTAINS', 'STARTS_WITH', 'EXACT', 'REGEX']).optional(),
    priority: z.number().int().min(1).max(9999).optional(),
    is_active: z.boolean().optional(),
  }),
})

export const deleteRuleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const categorizeManualSchema = z.object({
  body: z.object({
    statement_ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
    purpose_id: z.string().uuid(),
  }),
})

export const uncategorizeSchema = z.object({
  body: z.object({
    statement_ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
  }),
})

export const autoCategorizeSchema = z.object({
  body: z.object({
    bank_account_id: z.coerce.number().int().positive().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dry_run: z.boolean().default(false),
  }),
})

export const listUncategorizedSchema = z.object({
  query: z.object({
    bank_account_id: z.coerce.number().int().positive().optional(),
    purpose_id: z.string().uuid().optional(),
    categorized: z.enum(['true', 'false']).optional(),
    search: z.string().max(200).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
})
