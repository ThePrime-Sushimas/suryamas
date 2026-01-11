import { z } from '@/lib/openapi'

const VALID_STATUSES = ['DRAFT', 'APPROVED', 'EXPIRED', 'REJECTED'] as const
const VALID_CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD'] as const

export const createPricelistSchema = z.object({
  body: z.object({
    company_id: z.string().uuid('Invalid company ID'),
    branch_id: z.string().uuid('Invalid branch ID').nullable().optional(),
    supplier_id: z.string().uuid('Invalid supplier ID'),
    product_id: z.string().uuid('Invalid product ID'),
    uom_id: z.string().uuid('Invalid UOM ID'),
    price: z.number().positive('Price must be positive'),
    currency: z.enum(VALID_CURRENCIES).default('IDR'),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
    is_active: z.boolean().default(true),
  }).refine(
    (data) => {
      if (data.valid_to) {
        return new Date(data.valid_to) >= new Date(data.valid_from)
      }
      return true
    },
    { message: 'valid_to must be greater than or equal to valid_from' }
  ),
})

export const updatePricelistSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid pricelist ID'),
  }),
  body: z.object({
    price: z.number().positive('Price must be positive').optional(),
    currency: z.enum(VALID_CURRENCIES).optional(),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
    is_active: z.boolean().optional(),
  }),
})

export const pricelistIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid pricelist ID'),
  }),
})

export const pricelistListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    supplier_id: z.string().uuid('Invalid supplier ID').optional(),
    product_id: z.string().uuid('Invalid product ID').optional(),
    status: z.enum(VALID_STATUSES).optional(),
    is_active: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
    include_deleted: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
    search: z.string().optional(),
    sort_by: z.string().optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
  }),
})

export const approvalSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid pricelist ID'),
  }),
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
  }),
})

export const lookupPriceSchema = z.object({
  query: z.object({
    supplier_id: z.string().uuid('Invalid supplier ID'),
    product_id: z.string().uuid('Invalid product ID'),
    uom_id: z.string().uuid('Invalid UOM ID'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  }),
})
