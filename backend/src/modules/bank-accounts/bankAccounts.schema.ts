import { z } from 'zod'

export const createBankAccountSchema = z.object({
  body: z.object({
    bank_id: z.number().int().positive('Bank ID is required'),
    account_name: z.string()
      .min(1, 'Account name is required')
      .max(150, 'Account name must not exceed 150 characters')
      .trim(),
    account_number: z.string()
      .min(1, 'Account number is required')
      .max(50, 'Account number must not exceed 50 characters')
      .regex(/^[0-9]+$/, 'Account number must contain only digits')
      .trim(),
    owner_type: z.enum(['company', 'supplier'], {
      message: 'Owner type must be either company or supplier',
    }),
    owner_id: z.string().min(1, 'Owner ID is required').max(50),
    is_primary: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }),
})

export const updateBankAccountSchema = z.object({
  body: z.object({
    account_name: z.string()
      .min(1, 'Account name is required')
      .max(150, 'Account name must not exceed 150 characters')
      .trim()
      .optional(),
    account_number: z.string()
      .min(1, 'Account number is required')
      .max(50, 'Account number must not exceed 50 characters')
      .regex(/^[0-9]+$/, 'Account number must contain only digits')
      .trim()
      .optional(),
    is_primary: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid bank account ID format'),
  }),
})

export const bankAccountIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid bank account ID format'),
  }),
})

export const bankAccountListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    owner_type: z.enum(['company', 'supplier']).optional(),
    owner_id: z.string().max(50).optional(),
    bank_id: z.coerce.number().int().positive().optional(),
    is_active: z.coerce.boolean().optional(),
  }),
})

export const ownerBankAccountsSchema = z.object({
  params: z.object({
    owner_type: z.enum(['companies', 'suppliers']),
    id: z.string().min(1).max(50),
  }),
})
