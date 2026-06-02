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
    output_warehouse: z.enum(['READY', 'FINISHED_GOODS']).optional().default('READY'),
    output_product_id: z.string().uuid().nullable().optional(),
    ingredients: z.array(wipIngredientSchema).optional(),
  }).refine(
    (body) => {
      // Jika output_warehouse = FINISHED_GOODS, output_product_id wajib diisi
      if (body.output_warehouse === 'FINISHED_GOODS' && !body.output_product_id) {
        return false
      }
      return true
    },
    {
      message: 'output_product_id wajib diisi ketika output_warehouse adalah FINISHED_GOODS',
      path: ['output_product_id'],
    }
  ),
})

export const updateWipItemSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    wip_name: z.string().min(1).max(150).trim().optional(),
    uom: z.string().max(20).optional(),
    yield_qty: z.number().positive().optional(),
    notes: z.string().max(1000).nullable().optional(),
    is_active: z.boolean().optional(),
    output_warehouse: z.enum(['READY', 'FINISHED_GOODS']).optional(),
    output_product_id: z.string().uuid().nullable().optional(),
    ingredients: z.array(wipIngredientSchema).optional(),
  }).refine(
    (body) => {
      // Jika output_warehouse = FINISHED_GOODS, output_product_id wajib diisi
      // Use == null to handle both null and undefined (edge case: partial update tanpa output_product_id field)
      if (body.output_warehouse === 'FINISHED_GOODS' && body.output_product_id == null) {
        return false
      }
      return true
    },
    {
      message: 'output_product_id wajib diisi ketika output_warehouse adalah FINISHED_GOODS',
      path: ['output_product_id'],
    }
  ),
})

export const wipItemIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const bulkDeleteWipSchema = z.object({
  body: z.object({ ids: z.array(z.string().uuid()).min(1) }),
})

export const wipPositionAccessSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    position_ids: z.array(z.string().uuid()),
  }),
})
