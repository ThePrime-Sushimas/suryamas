import { z } from 'zod'

export const CreateBranchSchema = z.object({
  company_id: z.string().uuid('Invalid company ID'),
  branch_code: z.string().min(1, 'Branch code required'),
  branch_name: z.string().min(1, 'Branch name required'),
  address: z.string().min(1, 'Address required'),
  city: z.string().min(1, 'City required'),
  province: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().regex(/^[0-9+\-\s()]{6,20}$/, 'Invalid phone').optional(),
  whatsapp: z.string().regex(/^[0-9+\-\s()]{6,20}$/, 'Invalid phone').optional(),
  email: z.string().email('Invalid email').optional(),
  jam_buka: z.string().optional(),
  jam_tutup: z.string().optional(),
  hari_operasional: z.enum(['Senin-Jumat', 'Senin-Sabtu', 'Setiap Hari', 'Senin-Minggu']).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'maintenance', 'closed']).optional(),
  manager_id: z.string().optional(),
})

export const UpdateBranchSchema = CreateBranchSchema.partial().omit({ branch_code: true })

export type CreateBranchInput = z.infer<typeof CreateBranchSchema>
export type UpdateBranchInput = z.infer<typeof UpdateBranchSchema>
