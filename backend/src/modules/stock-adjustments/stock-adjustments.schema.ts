import { z } from 'zod'

export const adjustmentIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const adjustmentListSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    adjustment_type: z.enum(['WASTE', 'BREAKDOWN']).optional(),
    status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
    branch_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().optional(),
  })
})

export const createAdjustmentSchema = z.object({
  body: z.object({
    adjustment_type: z.enum(['WASTE', 'BREAKDOWN']),
    warehouse_id: z.string().uuid(),
    adjustment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.enum(['EXPIRED', 'DAMAGED', 'CONTAMINATED', 'OVERSTOCK', 'PROCESSING_LOSS', 'OTHER']).nullable().optional(),
    notes: z.string().nullable().optional(),
    // WASTE: multiple lines
    lines: z.array(z.object({
      product_id: z.string().uuid(),
      qty: z.number().gt(0, 'Qty harus lebih dari 0'),
      notes: z.string().nullable().optional(),
    })).optional(),
    // BREAKDOWN: single input + outputs
    input_product_id: z.string().uuid().optional(),
    input_qty: z.number().gt(0).optional(),
    outputs: z.array(z.object({
      product_id: z.string().uuid(),
      qty: z.number().gt(0, 'Qty output harus lebih dari 0'),
      notes: z.string().nullable().optional(),
    })).optional(),
  }).superRefine((b, ctx) => {
    if (b.adjustment_type === 'WASTE') {
      if (!b.lines || b.lines.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Waste harus memiliki minimal 1 produk', path: ['lines'] })
      }
    }
    if (b.adjustment_type === 'BREAKDOWN') {
      if (!b.input_product_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Breakdown harus memiliki produk input', path: ['input_product_id'] })
      }
      if (!b.input_qty || b.input_qty <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Qty input harus lebih dari 0', path: ['input_qty'] })
      }
      if (!b.outputs || b.outputs.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Breakdown harus memiliki minimal 1 output', path: ['outputs'] })
      }
      if (b.input_qty && b.outputs) {
        const totalOutput = b.outputs.reduce((sum, o) => sum + o.qty, 0)
        if (totalOutput > b.input_qty) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Total output tidak boleh melebihi input', path: ['outputs'] })
        }
      }
    }
  })
})

export const cancelAdjustmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({}).optional(),
})
