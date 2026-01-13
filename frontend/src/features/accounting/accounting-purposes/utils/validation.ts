import { z } from 'zod'

export const accountingPurposeSchema = z.object({
  purpose_code: z.string()
    .min(1, 'Purpose code is required')
    .max(50, 'Purpose code must be 50 characters or less')
    .regex(/^[A-Z0-9_\s]+$/, 'Purpose code must contain only uppercase letters, numbers, underscores, and spaces')
    .transform(val => val.toUpperCase().replace(/\s+/g, '_')),
  
  purpose_name: z.string()
    .min(1, 'Purpose name is required')
    .max(255, 'Purpose name must be 255 characters or less')
    .trim(),
  
  applied_to: z.enum(['SALES', 'PURCHASE', 'CASH', 'BANK', 'INVENTORY'] as const),
  
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .nullable(),
  
  is_active: z.boolean().default(true),
  
  branch_id: z.string().uuid().optional().nullable().or(z.literal('')).transform(val => val === '' ? null : val)
})

export const updateAccountingPurposeSchema = accountingPurposeSchema.omit({ 
  purpose_code: true
}).partial()

export const validatePurposeCode = (code: string): boolean => {
  if (!code || code.length > 50) return false
  const normalized = code.toUpperCase().replace(/\s+/g, '_')
  return /^[A-Z0-9_]+$/.test(normalized)
}