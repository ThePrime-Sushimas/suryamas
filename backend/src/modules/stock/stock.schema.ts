import { z } from '@/lib/openapi'

const movementTypes = [
  'IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN', 'IN_PRODUCTION',
  'IN_ADJUSTMENT', 'IN_OPENING',
  'OUT_TRANSFER', 'OUT_LOAN', 'OUT_DAILY', 'OUT_ADJUSTMENT',
  'OUT_WASTE', 'OUT_PRODUCTION',
] as const

const referenceTypes = [
  'purchase_order', 'transfer_order', 'branch_loan',
  'daily_requisition', 'production_order', 'adjustment', 'opening',
] as const

export const createMovementSchema = z.object({
  body: z.object({
    warehouse_id: z.string().uuid(),
    product_id: z.string().uuid(),
    movement_type: z.enum(movementTypes),
    qty: z.number().positive(),
    cost_per_unit: z.number().min(0),
    reference_type: z.enum(referenceTypes).optional(),
    reference_id: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
    movement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
})

export const createOpeningBalanceSchema = z.object({
  body: z.object({
    warehouse_id: z.string().uuid(),
    product_id: z.string().uuid(),
    qty: z.number().positive(),
    cost_per_unit: z.number().positive(),
    notes: z.string().max(500).optional(),
  }),
})

export const bulkOpeningBalanceSchema = z.object({
  body: z.object({
    warehouse_id: z.string().uuid(),
    items: z.array(z.object({
      product_id: z.string().uuid(),
      qty: z.number().positive(),
      cost_per_unit: z.number().positive(),
    })).min(1),
    notes: z.string().max(500).optional(),
  }),
})

export const adjustStockSchema = z.object({
  body: z.object({
    warehouse_id: z.string().uuid(),
    product_id: z.string().uuid(),
    new_qty: z.number().min(0),
    cost_per_unit: z.number().min(0).optional(),
    reason: z.string().min(1).max(500),
  }),
})

export const stockBalanceListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(500).optional().default(50),
    warehouse_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    warehouse_type: z.string().optional(),
    product_id: z.string().uuid().optional(),
    has_stock: z.string().optional(),
    search: z.string().optional(),
  }),
})

export const stockMovementListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    warehouse_id: z.string().uuid().optional(),
    product_id: z.string().uuid().optional(),
    movement_type: z.enum(movementTypes).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
})

export const upsertStockConfigSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    product_id: z.string().uuid(),
    reorder_point: z.number().min(0).nullable().optional(),
    safety_stock: z.number().min(0).nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
})
