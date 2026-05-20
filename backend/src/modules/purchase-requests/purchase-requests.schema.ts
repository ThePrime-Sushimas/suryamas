import { z } from '@/lib/openapi'

const lineSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().positive(),
  uom: z.string().min(1).max(20),
  supplier_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
})

export const createPurchaseRequestSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    request_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    needed_by_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    priority: z.enum(['normal', 'medium', 'high']).optional().default('normal'),
    notes: z.string().max(500).nullable().optional(),
    lines: z.array(lineSchema).min(1),
  }),
})

export const updatePurchaseRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    needed_by_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    lines: z.array(lineSchema).min(1).optional(),
    request_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
})

export const purchaseRequestIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const submitForApprovalSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const rejectSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    rejected_reason: z.string().min(1).max(500),
  }),
})

export const purchaseRequestListSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    status: z.string().optional(),
    branch_id: z.string().uuid().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
  }),
})

export const approveAndGenerateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    supplier_selections: z.array(z.object({
      supplier_id: z.string().uuid(),
      lines: z.array(z.object({
        pr_line_id: z.string().uuid(),
        qty_approved: z.number().positive(),
      })).min(1),
      payment_type: z.enum(['CASH', 'CREDIT']),
      payment_terms_days: z.number().int().min(0).nullable().optional(),
      expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    })).min(1),
  }),
})
