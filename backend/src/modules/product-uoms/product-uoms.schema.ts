import { z } from '@/lib/openapi'
import { VALID_UOM_STATUSES, UOM_LIMITS } from './product-uoms.constants'

const uuidSchema = z.string().uuid()

export const productUomIdSchema = z.object({
  params: z.object({
    uomId: uuidSchema,
  }),
})

export const createProductUomSchema = z.object({
  params: z.object({
    productId: uuidSchema,
  }),
  body: z.object({
    metric_unit_id: uuidSchema,
    conversion_factor: z.number()
      .positive()
      .min(UOM_LIMITS.MIN_CONVERSION_FACTOR)
      .max(UOM_LIMITS.MAX_CONVERSION_FACTOR),
    is_base_unit: z.boolean().optional(),
    base_price: z.number().nonnegative().optional(),
    is_default_stock_unit: z.boolean().optional(),
    is_default_purchase_unit: z.boolean().optional(),
    is_default_transfer_unit: z.boolean().optional(),
    status_uom: z.enum(VALID_UOM_STATUSES).optional(),
  }).refine(
    (data) => !data.is_base_unit || data.conversion_factor === 1,
    { message: 'Base unit must have conversion factor of 1', path: ['conversion_factor'] }
  ),
})

export const updateProductUomSchema = z.object({
  params: z.object({
    productId: uuidSchema,
    uomId: uuidSchema,
  }),
  body: z.object({
    metric_unit_id: uuidSchema.optional(),
    conversion_factor: z.number()
      .positive()
      .min(UOM_LIMITS.MIN_CONVERSION_FACTOR)
      .max(UOM_LIMITS.MAX_CONVERSION_FACTOR)
      .optional(),
    is_base_unit: z.boolean().optional(),
    base_price: z.number().nonnegative().optional(),
    is_default_stock_unit: z.boolean().optional(),
    is_default_purchase_unit: z.boolean().optional(),
    is_default_transfer_unit: z.boolean().optional(),
    status_uom: z.enum(VALID_UOM_STATUSES).optional(),
  }).refine(
    (data) => !data.is_base_unit || !data.conversion_factor || data.conversion_factor === 1,
    { message: 'Base unit must have conversion factor of 1', path: ['conversion_factor'] }
  ),
})

