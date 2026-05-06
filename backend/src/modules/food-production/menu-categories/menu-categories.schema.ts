import { z } from '@/lib/openapi'

export const createMenuCategorySchema = z.object({
  body: z.object({
    category_code: z.string().min(1).max(20).trim(),
    category_name: z.string().min(1).max(100).trim(),
    sales_coa_id: z.string().uuid().nullable().optional(),
    cogs_coa_id: z.string().uuid().nullable().optional(),
    sort_order: z.number().int().min(0).optional().default(0),
    is_active: z.boolean().optional().default(true),
  }),
})

export const updateMenuCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    category_name: z.string().min(1).max(100).trim().optional(),
    sales_coa_id: z.string().uuid().nullable().optional(),
    cogs_coa_id: z.string().uuid().nullable().optional(),
    sort_order: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
  }),
})

export const menuCategoryIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const bulkDeleteMenuCategorySchema = z.object({
  body: z.object({ ids: z.array(z.string().uuid()).min(1) }),
})
