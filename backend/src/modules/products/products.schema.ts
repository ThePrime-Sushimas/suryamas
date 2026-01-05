import { z } from 'zod'
import { VALID_PRODUCT_STATUSES, PRODUCT_LIMITS } from './products.constants'

export const createProductSchema = z.object({
  body: z.object({
    product_code: z.string().max(PRODUCT_LIMITS.PRODUCT_CODE_MAX_LENGTH).optional(),
    product_name: z.string().min(1).max(PRODUCT_LIMITS.PRODUCT_NAME_MAX_LENGTH),
    bom_name: z.string().max(PRODUCT_LIMITS.PRODUCT_NAME_MAX_LENGTH).optional(),
    category_id: z.string().uuid('Invalid category ID format'),
    sub_category_id: z.string().uuid('Invalid sub-category ID format'),
    is_requestable: z.boolean().optional(),
    is_purchasable: z.boolean().optional(),
    notes: z.string().max(PRODUCT_LIMITS.NOTES_MAX_LENGTH).optional(),
    status: z.enum(VALID_PRODUCT_STATUSES as [string, ...string[]]).optional(),
  }),
})

export const updateProductSchema = z.object({
  body: z.object({
    product_name: z.string().min(1).max(PRODUCT_LIMITS.PRODUCT_NAME_MAX_LENGTH).optional(),
    bom_name: z.string().max(PRODUCT_LIMITS.PRODUCT_NAME_MAX_LENGTH).optional(),
    category_id: z.string().uuid('Invalid category ID format').optional(),
    sub_category_id: z.string().uuid('Invalid sub-category ID format').optional(),
    is_requestable: z.boolean().optional(),
    is_purchasable: z.boolean().optional(),
    notes: z.string().max(PRODUCT_LIMITS.NOTES_MAX_LENGTH).optional(),
    status: z.enum(VALID_PRODUCT_STATUSES as [string, ...string[]]).optional(),
  }).refine((data) => !('product_code' in data), {
    message: 'Product code cannot be updated',
  }),
  params: z.object({
    id: z.string().uuid('Invalid product ID format'),
  }),
})

export const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(z.string().uuid()).min(1).max(PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE),
  }),
})

export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    ids: z.array(z.string().uuid()).min(1).max(PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE),
    status: z.enum(VALID_PRODUCT_STATUSES as [string, ...string[]]),
  }),
})

export const productIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid product ID format'),
  }),
})

export const checkProductNameSchema = z.object({
  query: z.object({
    product_name: z.string().min(1),
    excludeId: z.string().uuid().optional(),
  }),
})
