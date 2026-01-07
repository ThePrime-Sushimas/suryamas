import { z } from 'zod'
import { VALID_CURRENCIES, SUPPLIER_PRODUCT_LIMITS, SUPPLIER_PRODUCT_SORT_FIELDS } from './supplier-products.constants'

export const createSupplierProductSchema = z.object({
  body: z.object({
    supplier_id: z.number().int().positive('Supplier ID must be a positive integer'),
    product_id: z.string().uuid('Invalid product ID format'),
    price: z.number()
      .min(SUPPLIER_PRODUCT_LIMITS.MIN_PRICE, `Price must be at least ${SUPPLIER_PRODUCT_LIMITS.MIN_PRICE}`)
      .max(SUPPLIER_PRODUCT_LIMITS.MAX_PRICE, `Price cannot exceed ${SUPPLIER_PRODUCT_LIMITS.MAX_PRICE}`)
      .multipleOf(0.01, 'Price must have at most 2 decimal places'),
    currency: z.enum(VALID_CURRENCIES as [string, ...string[]]).optional(),
    lead_time_days: z.number().int()
      .min(0, 'Lead time must be non-negative')
      .max(SUPPLIER_PRODUCT_LIMITS.MAX_LEAD_TIME_DAYS, `Lead time cannot exceed ${SUPPLIER_PRODUCT_LIMITS.MAX_LEAD_TIME_DAYS} days`)
      .optional()
      .nullable(),
    min_order_qty: z.number()
      .min(SUPPLIER_PRODUCT_LIMITS.MIN_ORDER_QTY_MIN, `Minimum order quantity must be at least ${SUPPLIER_PRODUCT_LIMITS.MIN_ORDER_QTY_MIN}`)
      .optional()
      .nullable(),
    is_preferred: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }),
})

export const updateSupplierProductSchema = z.object({
  body: z.object({
    price: z.number()
      .min(SUPPLIER_PRODUCT_LIMITS.MIN_PRICE)
      .max(SUPPLIER_PRODUCT_LIMITS.MAX_PRICE)
      .multipleOf(0.01)
      .optional(),
    currency: z.enum(VALID_CURRENCIES as [string, ...string[]]).optional(),
    lead_time_days: z.number().int()
      .min(0)
      .max(SUPPLIER_PRODUCT_LIMITS.MAX_LEAD_TIME_DAYS)
      .optional()
      .nullable(),
    min_order_qty: z.number()
      .min(SUPPLIER_PRODUCT_LIMITS.MIN_ORDER_QTY_MIN)
      .optional()
      .nullable(),
    is_preferred: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  }),
  params: z.object({
    id: z.string().uuid('Invalid supplier product ID format'),
  }),
})

export const supplierProductIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid supplier product ID format'),
  }),
})

export const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(z.string().uuid('Invalid supplier product ID format'))
      .min(1, 'At least one ID must be provided')
      .max(SUPPLIER_PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE, `Cannot delete more than ${SUPPLIER_PRODUCT_LIMITS.MAX_BULK_OPERATION_SIZE} items at once`),
  }),
})

export const supplierProductListSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    search: z.string().min(1).max(SUPPLIER_PRODUCT_LIMITS.MAX_SEARCH_LENGTH).optional(),
    supplier_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    product_id: z.string().uuid().optional(),
    is_preferred: z.string().regex(/^(true|false)$/).transform(val => val === 'true').optional(),
    is_active: z.string().regex(/^(true|false)$/).transform(val => val === 'true').optional(),
    sort_by: z.enum(SUPPLIER_PRODUCT_SORT_FIELDS as [string, ...string[]]).optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
  }),
})

export const getBySupplierSchema = z.object({
  params: z.object({
    supplier_id: z.string().regex(/^\d+$/, 'Invalid supplier ID format').transform(Number),
  }),
})

export const getByProductSchema = z.object({
  params: z.object({
    product_id: z.string().uuid('Invalid product ID format'),
  }),
})