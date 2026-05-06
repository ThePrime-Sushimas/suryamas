import { z } from '@/lib/openapi'

export const createMenuGroupSchema = z.object({
  body: z.object({
    category_id: z.string().uuid(),
    group_code: z.string().min(1).max(20).trim(),
    group_name: z.string().min(1).max(100).trim(),
    sort_order: z.number().int().min(0).optional().default(0),
    is_active: z.boolean().optional().default(true),
  }),
})

export const updateMenuGroupSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    category_id: z.string().uuid().optional(),
    group_name: z.string().min(1).max(100).trim().optional(),
    sort_order: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
  }),
})

export const menuGroupIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const bulkDeleteMenuGroupSchema = z.object({
  body: z.object({ ids: z.array(z.string().uuid()).min(1) }),
})
