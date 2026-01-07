import { z } from 'zod'

const uuidSchema = z.string().uuid()
const companyTypes = ['PT', 'CV', 'Firma', 'Koperasi', 'Yayasan'] as const
const companyStatuses = ['active', 'inactive', 'suspended', 'closed'] as const

export const companyIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const createCompanySchema = z.object({
  body: z.object({
    company_code: z.string().min(1).max(20).trim(),
    company_name: z.string().min(1).max(200).trim(),
    company_type: z.enum(companyTypes).default('PT'),
    npwp: z.string().length(15).optional().nullable().or(z.literal('')),
    email: z.string().email().optional().nullable().or(z.literal('')),
    phone: z.string().min(10).max(20).optional().nullable().or(z.literal('')),
    website: z.string().url().optional().nullable().or(z.literal('')),
    status: z.enum(companyStatuses).default('active'),
  }),
})

export const updateCompanySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    company_name: z.string().min(1).max(200).trim().optional(),
    company_type: z.enum(companyTypes).optional(),
    npwp: z.string().length(15).optional().nullable().or(z.literal('')),
    email: z.string().email().optional().nullable().or(z.literal('')),
    phone: z.string().min(10).max(20).optional().nullable().or(z.literal('')),
    website: z.string().url().optional().nullable().or(z.literal('')),
    status: z.enum(companyStatuses).optional(),
  }),
})

export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
    status: z.enum(companyStatuses),
  }).strict(),
})

export const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
  }).strict(),
})
