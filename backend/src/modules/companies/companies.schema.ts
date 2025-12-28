import { z } from 'zod'

const companyTypes = ['PT', 'CV', 'Firma', 'Koperasi', 'Yayasan'] as const
const companyStatuses = ['active', 'inactive', 'suspended', 'closed'] as const

export const createCompanySchema = z.object({
  company_code: z.string().min(1, 'Company code is required').max(20).trim(),
  company_name: z.string().min(1, 'Company name is required').max(255).trim(),
  company_type: z.enum(companyTypes).default('PT'),
  npwp: z.string().length(15, 'NPWP must be 15 characters').optional().nullable().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  phone: z.string().min(10, 'Phone must be at least 10 characters').max(20).optional().nullable().or(z.literal('')),
  website: z.string().url('Invalid website URL').optional().nullable().or(z.literal('')),
  status: z.enum(companyStatuses).default('active')
})

export const updateCompanySchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(255).trim().optional(),
  company_type: z.enum(companyTypes).optional(),
  npwp: z.string().length(15, 'NPWP must be 15 characters').optional().nullable().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  phone: z.string().min(10, 'Phone must be at least 10 characters').max(20).optional().nullable().or(z.literal('')),
  website: z.string().url('Invalid website URL').optional().nullable().or(z.literal('')),
  status: z.enum(companyStatuses).optional()
})

export const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID is required'),
  status: z.enum(companyStatuses)
})

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one ID is required')
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
