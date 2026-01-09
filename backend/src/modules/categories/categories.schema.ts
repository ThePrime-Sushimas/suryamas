import { z } from '@/lib/openapi'

const uuidSchema = z.string().uuid()

export const categoryIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const CreateCategorySchema = z.object({
  body: z.object({
    category_code: z.string().min(1).max(50).trim(),
    category_name: z.string().min(1).max(255).trim(),
    description: z.string().max(1000).optional().nullable(),
    sort_order: z.number().int().min(0).optional().default(0),
    is_active: z.boolean().optional().default(true),
  }),
})

export const UpdateCategorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    category_name: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(1000).optional().nullable(),
    sort_order: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
  }),
})

export const UpdateStatusSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    is_active: z.boolean(),
  }),
})

export const BulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
  }),
})
