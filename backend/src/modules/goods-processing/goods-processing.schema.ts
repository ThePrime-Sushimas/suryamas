import { z } from '@/lib/openapi'

const uuidParam = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

const outputSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  qty_output: z.coerce.number().positive(),
  uom: z.string().min(1),
  is_waste: z.boolean().default(false),
  waste_reason: z.string().nullable().optional(),
  photo_urls: z.array(z.string()).nullable().optional(),
  sort_order: z.coerce.number().int().default(0),
})

const inputUpdateSchema = z.object({
  id: z.string().uuid(),
  outputs: z.array(outputSchema).min(1),
})

export const UpdateGoodsProcessingSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    processing_type: z.enum(['PASS_THROUGH', 'DISASSEMBLY']).optional(),
    notes: z.string().nullable().optional(),
    inputs: z.array(inputUpdateSchema).min(1),
  }),
})

export const RejectSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    rejection_reason: z.string().min(1, 'Alasan penolakan wajib diisi'),
  }),
})

export const ListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.string()
  .refine(val => val.split(',').every(s =>
    ['DRAFT','PROCESSING','PARTIAL','QC_REVIEW','CONFIRMED','REJECTED','CORRECTING'].includes(s.trim())
  ), { message: 'Invalid status value' })
  .optional(),
    branch_id: z.string().uuid().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    search: z.string().trim().max(100).optional(),
  }),
})

export const IdParamSchema = uuidParam

export const BulkConfirmSchema = z.object({
  body: z.object({
    ids: z.array(z.string().uuid()).min(1).max(50),
  }),
})

export const ResolveReturnSchema = z.object({
  body: z.object({
    resolution: z.enum(['STOCK', 'DISCARD']),
  }),
  params: z.object({
    id: z.string().uuid(),
    outputId: z.string().uuid(),
  }),
})
 