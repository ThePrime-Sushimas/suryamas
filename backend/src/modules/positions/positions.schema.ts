import { z } from '@/lib/openapi'

export const createPositionSchema = z.object({
  body: z.object({
    department_id: z.string().uuid(),
    position_code: z.string().min(1).max(30),
    position_name: z.string().min(1).max(100),
    can_access_all_wip: z.boolean().optional().default(false),
    sort_order: z.number().int().optional().default(0),
  }),
})

export const updatePositionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    department_id: z.string().uuid().optional(),
    position_name: z.string().min(1).max(100).optional(),
    can_access_all_wip: z.boolean().optional(),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
  }),
})

export const positionIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const listPositionsSchema = z.object({
  query: z.object({
    department_id: z.string().uuid().optional(),
  }),
})
