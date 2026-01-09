import { z } from '@/lib/openapi'

export const createBankSchema = z.object({
  body: z.object({
    bank_code: z.string()
      .min(2, 'Bank code must be at least 2 characters')
      .max(20, 'Bank code must not exceed 20 characters')
      .toUpperCase()
      .trim(),
    bank_name: z.string()
      .min(3, 'Bank name must be at least 3 characters')
      .max(100, 'Bank name must not exceed 100 characters')
      .trim(),
    is_active: z.boolean().optional(),
  }),
})

export const updateBankSchema = z.object({
  body: z.object({
    bank_name: z.string()
      .min(3, 'Bank name must be at least 3 characters')
      .max(100, 'Bank name must not exceed 100 characters')
      .trim()
      .optional(),
    is_active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid bank ID format'),
  }),
})

export const bankIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid bank ID format'),
  }),
})

export const bankListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().trim().optional(),
    is_active: z.coerce.boolean().optional(),
  }),
})
