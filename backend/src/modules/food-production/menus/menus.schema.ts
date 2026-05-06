import { z } from '@/lib/openapi'

export const createMenuSchema = z.object({
  body: z.object({
    pos_menu_id: z.number().int().positive().nullable().optional(),
    category_id: z.string().uuid(),
    group_id: z.string().uuid().nullable().optional(),
    menu_code: z.string().min(1).max(50).trim(),
    menu_name: z.string().min(1).max(150).trim(),
    selling_price: z.number().min(0).optional().default(0),
    is_active: z.boolean().optional().default(true),
    sync_enabled: z.boolean().optional().default(true),
  }),
})

export const updateMenuSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    category_id: z.string().uuid().optional(),
    group_id: z.string().uuid().nullable().optional(),
    menu_name: z.string().min(1).max(150).trim().optional(),
    selling_price: z.number().min(0).optional(),
    is_active: z.boolean().optional(),
    sync_enabled: z.boolean().optional(),
  }),
})

export const menuIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const bulkDeleteMenuSchema = z.object({
  body: z.object({ ids: z.array(z.string().uuid()).min(1) }),
})

export const syncMenusSchema = z.object({
  body: z.object({
    force: z.boolean().optional().default(false),
  }),
})
