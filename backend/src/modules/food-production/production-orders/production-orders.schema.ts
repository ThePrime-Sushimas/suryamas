import { z } from '@/lib/openapi'

const createLineSchema = z.object({
  wip_id: z.string().uuid(),
  planned_batch_qty: z.number().positive(),
})

export const createProductionOrderSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    production_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().optional(),
    lines: z.array(createLineSchema).min(1, 'Minimal 1 WIP harus dipilih'),
  }),
})

const completeMaterialSchema = z.object({
  id: z.string().uuid(),
  actual_qty: z.number().min(0),
  waste_qty: z.number().min(0).optional().default(0),
  waste_reason: z.string().optional(),
})

const completeLineSchema = z.object({
  id: z.string().uuid(),
  actual_batch_qty: z.number().min(0),
  materials: z.array(completeMaterialSchema),
})

export const completeProductionOrderSchema = z.object({
  body: z.object({
    lines: z.array(completeLineSchema).min(1),
  }),
  params: z.object({ id: z.string().uuid() }),
})

export const voidProductionOrderSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Alasan void wajib diisi'),
  }),
  params: z.object({ id: z.string().uuid() }),
})

export const listProductionOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    branch_id: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'COMPLETED', 'JOURNALED', 'VOID']).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    position_filter: z.string().optional(),
  }),
})

export const summarySchema = z.object({
  query: z.object({
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    branch_id: z.string().uuid().optional(),
  }),
})

export const materialsReportSchema = z.object({
  query: z.object({
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    branch_id: z.string().uuid().optional(),
  }),
})

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})
