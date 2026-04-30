import { z } from '@/lib/openapi'

// ============================================================
// Period Balance Schemas
// ============================================================

export const createPeriodBalanceSchema = z.object({
  body: z.object({
    bank_account_id: z.coerce.number().int().positive(),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    opening_balance: z.number(),
    source: z.enum(['MANUAL', 'AUTO_PREV_PERIOD']).optional().default('MANUAL'),
    previous_period_id: z.string().uuid().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  }).refine(d => d.period_end >= d.period_start, { message: 'period_end must be >= period_start', path: ['period_end'] }),
})

export const updatePeriodBalanceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    opening_balance: z.number().min(0).optional(),
    source: z.enum(['MANUAL', 'AUTO_PREV_PERIOD']).optional(),
    notes: z.string().max(500).nullable().optional(),
  }),
})

export const deletePeriodBalanceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const getSuggestionSchema = z.object({
  query: z.object({
    bank_account_id: z.coerce.number().int().positive(),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
})

export const listPeriodsSchema = z.object({
  query: z.object({
    bank_account_id: z.coerce.number().int().positive(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
})

// ============================================================
// Payment Method Groups Schemas
// ============================================================

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).nullable().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color').optional(),
    icon: z.string().max(50).nullable().optional(),
    display_order: z.number().int().min(0).optional(),
    payment_method_ids: z.array(z.coerce.number().int().positive()).optional(),
  }),
})

export const updateGroupSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    icon: z.string().max(50).nullable().optional(),
    display_order: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
    payment_method_ids: z.array(z.coerce.number().int().positive()).optional(),
  }),
})

export const deleteGroupSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const reorderGroupsSchema = z.object({
  body: z.object({
    ordered_ids: z.array(z.string().uuid()).min(1),
  }),
})

export const getCashFlowDailySchema = z.object({
  query: z.object({
    bank_account_id: z.coerce.number().int().positive(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    branch_id: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  }).refine(d => d.date_to >= d.date_from, {
    message: 'date_to must be on or after date_from',
    path: ['date_to'],
  }),
})

export type CreateGroupInput = z.infer<typeof createGroupSchema>['body']
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>['body']
export type GetCashFlowDailyInput = z.infer<typeof getCashFlowDailySchema>['query']
