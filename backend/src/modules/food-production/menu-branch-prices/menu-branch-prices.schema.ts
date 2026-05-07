import { z } from '@/lib/openapi'

export const createMenuBranchPriceSchema = z.object({
  body: z.object({
    menu_id: z.string().uuid(),
    branch_id: z.string().uuid(),
    selling_price: z.number().positive(),
    price_type: z.enum(['DINE_IN', 'DELIVERY', 'TAKEAWAY']).optional().default('DINE_IN'),
  }),
})

export const updateMenuBranchPriceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    selling_price: z.number().positive(),
  }),
})

export const menuBranchPriceIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const listMenuBranchPricesSchema = z.object({
  query: z.object({
    menu_id: z.string().uuid(),
  }),
})

export const syncFromPosSchema = z.object({
  body: z.object({
    menu_id: z.string().uuid().optional(),
  }),
})
