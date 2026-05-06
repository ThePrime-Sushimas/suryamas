import { z } from '@/lib/openapi'

const recipeLineSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  wip_id: z.string().uuid().nullable().optional(),
  qty: z.number().positive(),
  uom: z.string().max(20).optional().default('gram'),
}).refine(
  (d) => (d.product_id && !d.wip_id) || (!d.product_id && d.wip_id),
  { message: 'Each line must have either product_id or wip_id, not both' }
)

export const saveRecipeSchema = z.object({
  params: z.object({ menuId: z.string().uuid() }),
  body: z.object({
    lines: z.array(recipeLineSchema).min(0),
  }),
})

export const getRecipeSchema = z.object({
  params: z.object({ menuId: z.string().uuid() }),
})

export const recalculateProductSchema = z.object({
  params: z.object({ productId: z.string().uuid() }),
})

export const recalculateWipSchema = z.object({
  params: z.object({ wipId: z.string().uuid() }),
})
