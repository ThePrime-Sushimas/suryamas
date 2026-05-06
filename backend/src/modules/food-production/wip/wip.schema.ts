import { z } from '@/lib/openapi'

const wipIngredientSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().positive(),
  uom: z.string().max(20).optional().default('gram'),
})

export const createWipItemSchema = z.object({
  body: z.object({
    wip_code: z.string().min(1).max(50).trim(),
    wip_name: z.string().min(1).max(150).trim(),
    uom: z.string().max(20).optional().default('gram'),
    yield_qty: z.number().positive().optional().default(1),
    notes: z.string().max(1000).nullable().optional(),
    is_active: z.boolean().optional().default(true),
    ingredients: z.array(wipIngredientSchema).optional(),
  }),
})

export const updateWipItemSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    wip_name: z.string().min(1).max(150).trim().optional(),
    uom: z.string().max(20).optional(),
    yield_qty: z.number().positive().optional(),
    notes: z.string().max(1000).nullable().optional(),
    is_active: z.boolean().optional(),
    ingredients: z.array(wipIngredientSchema).optional(),
  }),
})

export const wipItemIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const bulkDeleteWipSchema = z.object({
  body: z.object({ ids: z.array(z.string().uuid()).min(1) }),
})
