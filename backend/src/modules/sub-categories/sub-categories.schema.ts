import { z } from 'zod'

// Create sub-category
export const CreateSubCategorySchema = z.object({
  category_id: z.string().uuid('Invalid category ID format'),
  sub_category_code: z.string().min(1, 'Sub-category code is required').max(50, 'Sub-category code must not exceed 50 characters').trim(),
  sub_category_name: z.string().min(1, 'Sub-category name is required').max(255, 'Sub-category name must not exceed 255 characters').trim(),
  description: z.string().max(1000, 'Description must not exceed 1000 characters').optional(),
  sort_order: z.number().int().min(0, 'Sort order must be non-negative').optional().default(0),
})

// Update sub-category
export const UpdateSubCategorySchema = z.object({
  sub_category_name: z.string().min(1, 'Sub-category name is required').max(255, 'Sub-category name must not exceed 255 characters').trim().optional(),
  description: z.string().max(1000, 'Description must not exceed 1000 characters').optional(),
  sort_order: z.number().int().min(0, 'Sort order must be non-negative').optional(),
})

// Bulk delete
export const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid('Invalid ID format')).min(1, 'At least one ID required'),
})

// Query params for pagination
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(10),
  category_id: z.string().uuid('Invalid category ID format').optional(),
})

// Export types
export type CreateSubCategoryInput = z.infer<typeof CreateSubCategorySchema>
export type UpdateSubCategoryInput = z.infer<typeof UpdateSubCategorySchema>
export type BulkDeleteInput = z.infer<typeof BulkDeleteSchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
