import { z } from 'zod'

// ─── PARAMS ───────────────────────────────────────────────────────────────────

export const dpoIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const dpoLineIdSchema = z.object({
  params: z.object({ id: z.string().uuid(), lineId: z.string().uuid() }),
})

export const branchIdParamSchema = z.object({
  params: z.object({ branchId: z.string().uuid() }),
})

export const holidayIdSchema = z.object({
  params: z.object({ holidayId: z.string().uuid() }),
})

// ─── LIST ─────────────────────────────────────────────────────────────────────

export const dpoListSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    branch_id: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
})

// ─── GENERATE ─────────────────────────────────────────────────────────────────

export const generateDpoSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    prep_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source_warehouse_id: z.string().uuid(),
    target_warehouse_id: z.string().uuid(),
    notes: z.string().nullable().optional(),
  })
})

// ─── LINES ────────────────────────────────────────────────────────────────────

export const updateDpoLinesSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    lines: z.array(z.object({
      id: z.string().uuid(),
      confirmed_qty: z.number().min(0).nullable(),
      notes: z.string().nullable().optional(),
    })).min(1),
  })
})

// ─── CONFIRM / CANCEL ─────────────────────────────────────────────────────────

export const confirmDpoSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    lock_token: z.string().uuid(),
  })
})

export const cancelDpoSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    reason: z.string().min(1).max(255),
  })
})

// ─── FORECAST CONFIG ──────────────────────────────────────────────────────────

export const upsertForecastConfigSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    weight_7d: z.number().min(0).max(1),
    weight_30d: z.number().min(0).max(1),
    weight_dow: z.number().min(0).max(1),
    coverage_days: z.number().min(0.5).max(7),
    holiday_factor: z.number().min(1).max(3),
    lookback_days_short: z.number().int().min(3).max(14).optional(),
    lookback_days_long: z.number().int().min(14).max(90).optional(),
  })
})

// ─── HOLIDAYS ─────────────────────────────────────────────────────────────────

export const upsertHolidaySchema = z.object({
  body: z.object({
    holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    holiday_name: z.string().min(1).max(100),
  })
})