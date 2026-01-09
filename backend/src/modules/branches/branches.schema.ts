import { z } from '@/lib/openapi'

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/
const uuidSchema = z.string().uuid()

export const branchIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const CreateBranchSchema = z.object({
  body: z.object({
    company_id: z.string().uuid('Invalid company ID'),
    branch_code: z.string().min(1).max(50),
    branch_name: z.string().min(1).max(255),
    status: z.enum(['active', 'inactive']).default('active'),
    manager_id: z.string().uuid().nullable().optional(),
    address: z.string().min(1),
    city: z.string().min(1),
    province: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    country: z.string().default('Indonesia'),
    phone: z.string().max(20).nullable().optional(),
    whatsapp: z.string().max(20).nullable().optional(),
    email: z.string().email().nullable().optional(),
    notes: z.string().nullable().optional(),
    jam_buka: z.string().regex(timeRegex, 'Invalid time format').default('10:00:00'),
    jam_tutup: z.string().regex(timeRegex, 'Invalid time format').default('22:00:00'),
    hari_operasional: z.array(z.string()).min(1, 'At least one operating day required').default([]),
  }),
})

export type CreateBranchInput = z.infer<typeof CreateBranchSchema.shape.body>

export const UpdateBranchSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: CreateBranchSchema.shape.body.partial().omit({ branch_code: true }),
})

export type UpdateBranchInput = z.infer<typeof UpdateBranchSchema.shape.body>

export const BulkUpdateStatusSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1, 'At least one ID required'),
    status: z.enum(['active', 'inactive']),
  }),
})
