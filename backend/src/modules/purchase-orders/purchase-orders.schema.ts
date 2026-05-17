import { z } from '@/lib/openapi'

const paymentTypes = ['CASH', 'CREDIT'] as const

const lineSchema = z.object({
  pr_line_id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid(),
  supplier_product_id: z.string().uuid().nullable().optional(),
  qty: z.number().positive(),
  uom: z.string().min(1).max(20),
  unit_price: z.number().min(0),
  notes: z.string().max(200).nullable().optional(),
})

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    supplier_id: z.string().uuid(),
    purchase_request_id: z.string().uuid(),
    order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    payment_type: z.enum(paymentTypes),
    payment_terms_days: z.number().int().min(1).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    lines: z.array(lineSchema).min(1),
  }),
})

export const updatePurchaseOrderSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    lines: z.array(lineSchema).min(1).optional(),
  }),
})

export const paymentDuePreviewSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
})

export const purchaseOrderIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const cancelSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    cancelled_reason: z.string().min(1).max(500),
  }),
})

export const purchaseOrderListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    status: z.string().optional(),
    supplier_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
})
