import { z } from 'zod'

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/

export const CreateBranchSchema = z.object({
  company_id: z.string().uuid('Invalid company ID'),

  branch_code: z.string().min(1).max(50),
  branch_name: z.string().min(1).max(255),

  status: z.enum(['active', 'inactive', 'maintenance', 'closed']).default('active'),

  manager_id: z.string().uuid().optional(),

  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().default('Indonesia'),

  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  email: z.string().email().optional(),

  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),

  notes: z.string().optional(),

  jam_buka: z.string().regex(timeRegex, 'Invalid time format').default('10:00:00'),
  jam_tutup: z.string().regex(timeRegex, 'Invalid time format').default('22:00:00'),

  hari_operasional: z.enum([
    'Senin-Jumat',
    'Senin-Sabtu',
    'Setiap Hari',
    'Senin-Minggu',
  ]).default('Senin-Minggu'),
})
export const UpdateBranchSchema =
  CreateBranchSchema.partial().omit({ branch_code: true })

// Bulk update status validation schema
export const BulkUpdateStatusSchema = z.object({
  ids: z.array(z.string().uuid('Invalid ID format')).min(1, 'At least one ID required'),
  status: z.enum(['active', 'inactive', 'maintenance', 'closed'])
})

export type CreateBranchInput = z.infer<typeof CreateBranchSchema>
export type UpdateBranchInput = z.infer<typeof UpdateBranchSchema>
export type BulkUpdateStatusInput = z.infer<typeof BulkUpdateStatusSchema>
