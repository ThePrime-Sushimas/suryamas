import { z } from 'zod'

// ─── PARAMS ───────────────────────────────────────────────────────────────────

export const productionRequestIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

// ─── LIST ─────────────────────────────────────────────────────────────────────

export const productionRequestListSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(['DRAFT', 'ACCEPTED', 'RECEIVED', 'CANCELLED']).optional(),
    requesting_branch_id: z.string().uuid().optional(),
    fulfilling_branch_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().optional(),
  }),
})

// ─── CREATE ───────────────────────────────────────────────────────────────────

export const createProductionRequestSchema = z.object({
  body: z.object({
    requesting_branch_id: z.string().uuid(),
    fulfilling_branch_id: z.string().uuid(),
    request_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().nullable().optional(),
    lines: z.array(z.object({
      product_id: z.string().uuid(),
      qty: z.number().gt(0, 'Qty harus lebih dari 0'),
      uom: z.string().min(1, 'UOM wajib diisi'),
      notes: z.string().nullable().optional(),
    })).min(1, 'Minimal 1 produk harus ditambahkan'),
  }).refine(b => b.requesting_branch_id !== b.fulfilling_branch_id, {
    message: 'Cabang peminta dan cabang penerima order tidak boleh sama',
    path: ['fulfilling_branch_id'],
  }),
})

// ─── UPDATE (DRAFT only) ─────────────────────────────────────────────────────

export const updateProductionRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    fulfilling_branch_id: z.string().uuid().optional(),
    request_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().nullable().optional(),
    lines: z.array(z.object({
      product_id: z.string().uuid(),
      qty: z.number().gt(0, 'Qty harus lebih dari 0'),
      uom: z.string().min(1, 'UOM wajib diisi'),
      notes: z.string().nullable().optional(),
    })).min(1, 'Minimal 1 produk').optional(),
  }),
})

// ─── ACCEPT ───────────────────────────────────────────────────────────────────

export const acceptProductionRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    accept_notes: z.string().nullable().optional(),
    lines: z.array(z.object({
      id: z.string().uuid(),
      qty_approved: z.number().gte(0, 'Qty approved tidak boleh negatif'),
    })).optional(),
  }),
})

// ─── RECEIVE ──────────────────────────────────────────────────────────────────

export const receiveProductionRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    receive_notes: z.string().nullable().optional(),
  }),
})

// ─── CANCEL ───────────────────────────────────────────────────────────────────

export const cancelProductionRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    cancel_reason: z.string().optional(),
  }).optional(),
})
