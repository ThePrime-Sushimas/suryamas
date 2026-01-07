import { z } from 'zod'

const uuidSchema = z.string().uuid()

export const subCategoryIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const categoryIdSchema = z.object({
  params: z.object({
    categoryId: uuidSchema,
  }),
})

export const CreateSubCategorySchema = z.object({
  body: z.object({
    category_id: uuidSchema,
    sub_category_code: z.string().min(1).max(50).trim(),
    sub_category_name: z.string().min(1).max(255).trim(),
    description: z.string().max(1000).optional(),
    sort_order: z.number().int().min(0).optional().default(0),
  }),
})

export const UpdateSubCategorySchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    sub_category_name: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(1000).optional(),
    sort_order: z.number().int().min(0).optional(),
  }),
})

export const BulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(uuidSchema).min(1),
  }),
})
