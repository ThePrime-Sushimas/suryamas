import { z } from 'zod'

export const bankAccountSchema = z.object({
  bank_id: z.number().min(1, 'Please select a bank'),
  
  account_name: z.string()
    .min(1, 'Account name is required')
    .max(150, 'Account name must not exceed 150 characters'),
  
  account_number: z.string()
    .min(1, 'Account number is required')
    .max(50, 'Account number must not exceed 50 characters')
    .regex(/^[0-9]+$/, 'Account number must contain only digits'),
  
  is_primary: z.boolean(),
  is_active: z.boolean(),
  
  // Optional COA link
  coa_account_id: z.string().uuid('Invalid COA account ID').optional().nullable(),
})

export type BankAccountFormData = z.infer<typeof bankAccountSchema>
