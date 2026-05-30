import { z } from 'zod'

// ─── PARAMS ───────────────────────────────────────────────────────────────────

export const getByIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const confirmSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const cancelSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const photoUploadSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    lineId: z.string().uuid(),
  }),
})

// ─── CREATE ───────────────────────────────────────────────────────────────────

export const createOpnameSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
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
  }),
})

export const bulkUpdateLinesSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    lines: z.array(z.object({
      line_id: z.string().uuid(),
      actual_qty: z.number().min(0),
    })).min(1).max(500),
  }),
})

// ─── RESOLVE ──────────────────────────────────────────────────────────────────

export const resolveSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    resolution_note: z.string().min(10).max(1000),
  }),
})

// ─── CONFIG ───────────────────────────────────────────────────────────────────

export const configSchema = z.object({
  params: z.object({ branchId: z.string().uuid() }),
  body: z.object({
    variance_threshold_pct: z.number().min(1).max(100).optional(),
    closing_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    grace_period_minutes: z.number().min(0).max(60).optional(),
  }),
})

// ─── LIST ─────────────────────────────────────────────────────────────────────

export const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    branch_id: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'CONFIRMED', 'FLAGGED', 'MISSED', '']).optional(),
    search: z.string().optional(),
  }),
})

// ─── REPORTS ──────────────────────────────────────────────────────────────────

export const varianceReportSchema = z.object({
  query: z.object({
    date_from: z.string(),
    date_to: z.string(),
    branch_id: z.string().uuid().optional(),
    product_id: z.string().uuid().optional(),
    risk_category: z.enum(['HIGH', 'MEDIUM', 'LOW', '']).optional(),
    group_by: z.enum(['day', 'week', 'month']).default('day'),
  }),
})

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export const dashboardSchema = z.object({
  query: z.object({}).optional(),
})
