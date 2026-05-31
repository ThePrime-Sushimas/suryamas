import { z } from 'zod'

// ─── PARAMS ───────────────────────────────────────────────────────────────────

export const transferIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

// ─── LIST ─────────────────────────────────────────────────────────────────────

export const transferListSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    transfer_type: z.enum(['TRANSFER', 'LOAN']).optional(),
    status: z.enum(['DRAFT', 'CONFIRMED', 'RETURNED', 'CANCELLED']).optional(),
    source_branch_id: z.string().uuid().optional(),
    target_branch_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().optional(),
  })
})

// ─── CREATE ───────────────────────────────────────────────────────────────────

export const createTransferSchema = z.object({
  body: z.object({
    transfer_type: z.enum(['TRANSFER', 'LOAN']).optional().default('TRANSFER'),
    source_warehouse_id: z.string().uuid(),
    target_warehouse_id: z.string().uuid(),
    transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().nullable().optional(),
    lines: z.array(z.object({
      product_id: z.string().uuid(),
      qty: z.number().gt(0, 'Qty harus lebih dari 0'),
      notes: z.string().nullable().optional(),
    })).min(1, 'Minimal 1 produk harus ditambahkan'),
  }).refine(b => b.source_warehouse_id !== b.target_warehouse_id, {
    message: 'Gudang sumber dan tujuan tidak boleh sama',
    path: ['target_warehouse_id'],
  })
})

// ─── CANCEL ───────────────────────────────────────────────────────────────────

export const cancelTransferSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    cancel_reason: z.string().optional(),
  }).optional(),
})
