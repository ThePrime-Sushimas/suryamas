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
    status: z.enum(['DRAFT', 'PROCESSING', 'QC_REVIEW', 'CONFIRMED', 'REJECTED']).optional(),
    branch_id: z.string().uuid().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
  }),
})

export const IdParamSchema = uuidParam

export const BulkConfirmSchema = z.object({
  body: z.object({
    ids: z.array(z.string().uuid()).min(1).max(50),
  }),
})
