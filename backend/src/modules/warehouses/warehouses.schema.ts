import { z } from '@/lib/openapi'

const warehouseTypes = ['MAIN', 'READY', 'CENTRAL_STOCK', 'CENTRAL_KITCHEN'] as const

export const createWarehouseSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    warehouse_code: z.string().min(1).max(30).trim(),
    warehouse_name: z.string().min(1).max(100).trim(),
    warehouse_type: z.enum(warehouseTypes).optional().default('MAIN'),
    is_active: z.boolean().optional().default(true),
  }),
})

export const updateWarehouseSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    warehouse_name: z.string().min(1).max(100).trim().optional(),
    warehouse_type: z.enum(warehouseTypes).optional(),
    is_active: z.boolean().optional(),
  }),
})

export const warehouseIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const bulkDeleteWarehouseSchema = z.object({
  body: z.object({ ids: z.array(z.string().uuid()).min(1) }),
})

export const warehouseListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    branch_id: z.string().uuid().optional(),
    warehouse_type: z.enum(warehouseTypes).optional(),
    is_active: z.string().optional(),
  }),
})
