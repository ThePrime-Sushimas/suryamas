import { z } from 'zod'

// ─── PARAMS ───────────────────────────────────────────────────────────────────

export const getByIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const lineParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    lineId: z.string().uuid(),
  }),
})

// ─── CREATE ───────────────────────────────────────────────────────────────────

export const createSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    warehouse_id: z.string().uuid(),
    opname_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    scope: z.enum(['ALL_PRODUCTS', 'BY_POSITION']),
    position_id: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
  }),
})

// ─── LINE UPDATES ─────────────────────────────────────────────────────────────

export const updateLineSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    lineId: z.string().uuid(),
  }),
  body: z.object({
    actual_qty: z.number().min(0),
    investigasi_note: z.string().max(1000).nullable().optional(),
  }),
})

export const bulkUpdateLinesSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    lines: z.array(z.object({
      line_id: z.string().uuid(),
      actual_qty: z.number().min(0),
      investigasi_note: z.string().max(1000).nullable().optional(),
    })).min(1).max(500),
  }),
})

// ─── LIST ─────────────────────────────────────────────────────────────────────

export const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    branch_id: z.string().uuid().optional(),
    warehouse_id: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'CONFIRMED', 'REOPENED', '']).optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    search: z.string().optional(),
  }),
})

// ─── REOPEN ───────────────────────────────────────────────────────────────────

export const createReopenRequestSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1, 'Alasan wajib diisi'),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const respondReopenRequestSchema = z.object({
  body: z.object({
    response_note: z.string().optional(),
  }),
  params: z.object({
    requestId: z.string().uuid(),
  }),
})

export const getReopenRequestsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})
