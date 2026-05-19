import { z } from '@/lib/openapi'

const lineSchema = z.object({
  po_line_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_po_uom: z.number().positive().optional(),
  qty_received: z.number().positive(),
  uom_received: z.string().max(30).optional(),
  qty_rejected: z.number().min(0).optional().default(0),
  reject_reason: z.string().max(50).nullable().optional(),
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
    notes: z.string().max(500).nullable().optional(),
    lines: z.array(lineSchema).min(1),
  }),
})

export const confirmGoodsReceiptSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
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
    invoice_number: z.string().optional(),
    source: z.string().optional(),
  }),
})

export const pendingQtySchema = z.object({
  query: z.object({
    po_id: z.string().uuid(),
    exclude_gr_id: z.string().uuid().optional(),
  }),
})

export const updateGoodsReceiptSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    warehouse_id: z.string().uuid().optional(),
    received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    invoice_number: z.string().max(100).nullable().optional(),
    invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    lines: z.array(lineSchema).min(1).optional(),
  }),
})

export const attachmentParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const createAttachmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    file_type: z.enum(['INVOICE', 'DELIVERY_NOTE', 'SURAT_JALAN', 'PHOTO_BARANG', 'OTHER']),
  }),
})

export const deleteAttachmentSchema = z.object({
  params: z.object({ id: z.string().uuid(), attachmentId: z.string().uuid() }),
})
