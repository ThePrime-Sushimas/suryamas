import { z } from 'zod'

// Create category
export const CreateCategorySchema = z.object({
  category_code: z.string().min(1, 'Category code is required').max(50, 'Category code must not exceed 50 characters').trim(),
  category_name: z.string().min(1, 'Category name is required').max(255, 'Category name must not exceed 255 characters').trim(),
  description: z.string().max(1000, 'Description must not exceed 1000 characters').optional().nullable(),
  sort_order: z.number().int().min(0, 'Sort order must be non-negative').optional().default(0),
  is_active: z.boolean().optional().default(true),
})

// Update category
export const UpdateCategorySchema = z.object({
  category_name: z.string().min(1, 'Category name is required').max(255, 'Category name must not exceed 255 characters').trim().optional(),
  description: z.string().max(1000, 'Description must not exceed 1000 characters').optional().nullable(),
  sort_order: z.number().int().min(0, 'Sort order must be non-negative').optional(),
  is_active: z.boolean().optional(),
})

// Update status
export const UpdateStatusSchema = z.object({
  is_active: z.boolean(),
})

// Bulk delete
export const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid('Invalid ID format')).min(1, 'At least one ID required'),
})

// Query params for pagination
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(10),
  is_active: z.coerce.boolean().optional(),
})

// Export types
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>
export type BulkDeleteInput = z.infer<typeof BulkDeleteSchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
