import { z } from 'zod'

export const bankSchema = z.object({
  bank_code: z.string()
    .min(2, 'Bank code must be at least 2 characters')
    .max(20, 'Bank code must not exceed 20 characters')
    .regex(/^[A-Z0-9_]+$/, 'Bank code must be uppercase letters, numbers, or underscores'),
  
  bank_name: z.string()
    .min(3, 'Bank name must be at least 3 characters')
    .max(100, 'Bank name must not exceed 100 characters'),
  
  is_active: z.boolean()
})

export type BankFormData = z.infer<typeof bankSchema>
