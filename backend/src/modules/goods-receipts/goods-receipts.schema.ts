import { z } from '@/lib/openapi'

const lineSchema = z.object({
  po_line_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_received: z.number().positive(),
  unit_price_invoice: z.number().min(0),
  notes: z.string().max(200).nullable().optional(),
})

export const createGoodsReceiptSchema = z.object({
  body: z.object({
    po_id: z.string().uuid(),
    warehouse_id: z.string().uuid(),
    received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    invoice_number: z.string().max(100).nullable().optional(),
    invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    invoice_photo_url: z.string().url().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    lines: z.array(lineSchema).min(1),
  }),
})

export const confirmGoodsReceiptSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    invoice_photo_url: z.string().url().optional(),
  }).optional(),
})

export const goodsReceiptIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const goodsReceiptListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    status: z.string().optional(),
    po_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
})
