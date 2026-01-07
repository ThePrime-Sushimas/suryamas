import { z } from 'zod'
import { VALID_SUPPLIER_TYPES, SUPPLIER_LIMITS } from './suppliers.constants'

const phoneRegex = /^\+?[0-9]{10,15}$/
const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export const createSupplierSchema = z.object({
  body: z.object({
    supplier_code: z.string()
      .min(1, 'Supplier code is required')
      .max(SUPPLIER_LIMITS.SUPPLIER_CODE_MAX_LENGTH)
      .trim(),
    supplier_name: z.string()
      .min(1, 'Supplier name is required')
      .max(SUPPLIER_LIMITS.SUPPLIER_NAME_MAX_LENGTH)
      .trim(),
    supplier_type: z.enum(VALID_SUPPLIER_TYPES as [string, ...string[]]),
    contact_person: z.string()
      .min(1, 'Contact person is required')
      .max(SUPPLIER_LIMITS.CONTACT_PERSON_MAX_LENGTH)
      .trim(),
    phone: z.string()
      .regex(phoneRegex, 'Phone must be 10-15 digits'),
    email: z.string()
      .regex(emailRegex, 'Invalid email format')
      .max(SUPPLIER_LIMITS.EMAIL_MAX_LENGTH)
      .optional(),
    address: z.string()
      .min(1, 'Address is required')
      .max(SUPPLIER_LIMITS.ADDRESS_MAX_LENGTH)
      .trim(),
    city: z.string()
      .min(1, 'City is required')
      .max(SUPPLIER_LIMITS.CITY_MAX_LENGTH)
      .trim(),
    province: z.string()
      .min(1, 'Province is required')
      .max(SUPPLIER_LIMITS.PROVINCE_MAX_LENGTH)
      .trim(),
    postal_code: z.string()
      .max(SUPPLIER_LIMITS.POSTAL_CODE_MAX_LENGTH)
      .trim()
      .optional(),
    tax_id: z.string()
      .max(SUPPLIER_LIMITS.TAX_ID_MAX_LENGTH)
      .trim()
      .optional(),
    business_license: z.string()
      .max(SUPPLIER_LIMITS.BUSINESS_LICENSE_MAX_LENGTH)
      .trim()
      .optional(),
    payment_term_id: z.number().int().positive().optional(),
    lead_time_days: z.number()
      .int()
      .min(0)
      .max(SUPPLIER_LIMITS.LEAD_TIME_MAX_DAYS)
      .optional(),
    minimum_order: z.number().min(0).optional(),
    rating: z.number()
      .int()
      .min(SUPPLIER_LIMITS.RATING_MIN)
      .max(SUPPLIER_LIMITS.RATING_MAX)
      .optional(),
    is_active: z.boolean().optional(),
    notes: z.string()
      .max(SUPPLIER_LIMITS.NOTES_MAX_LENGTH)
      .trim()
      .optional(),
  }),
})

export const updateSupplierSchema = z.object({
  body: z.object({
    supplier_name: z.string()
      .min(1, 'Supplier name is required')
      .max(SUPPLIER_LIMITS.SUPPLIER_NAME_MAX_LENGTH)
      .trim()
      .optional(),
    supplier_type: z.enum(VALID_SUPPLIER_TYPES as [string, ...string[]]).optional(),
    contact_person: z.string()
      .max(SUPPLIER_LIMITS.CONTACT_PERSON_MAX_LENGTH)
      .trim()
      .optional(),
    phone: z.string()
      .regex(phoneRegex, 'Phone must be 10-15 digits')
      .optional(),
    email: z.string()
      .regex(emailRegex, 'Invalid email format')
      .max(SUPPLIER_LIMITS.EMAIL_MAX_LENGTH)
      .optional(),
    address: z.string()
      .max(SUPPLIER_LIMITS.ADDRESS_MAX_LENGTH)
      .trim()
      .optional(),
    city: z.string()
      .max(SUPPLIER_LIMITS.CITY_MAX_LENGTH)
      .trim()
      .optional(),
    province: z.string()
      .max(SUPPLIER_LIMITS.PROVINCE_MAX_LENGTH)
      .trim()
      .optional(),
    postal_code: z.string()
      .max(SUPPLIER_LIMITS.POSTAL_CODE_MAX_LENGTH)
      .trim()
      .optional(),
    tax_id: z.string()
      .max(SUPPLIER_LIMITS.TAX_ID_MAX_LENGTH)
      .trim()
      .optional(),
    business_license: z.string()
      .max(SUPPLIER_LIMITS.BUSINESS_LICENSE_MAX_LENGTH)
      .trim()
      .optional(),
    payment_term_id: z.number().int().positive().optional(),
    lead_time_days: z.number()
      .int()
      .min(0)
      .max(SUPPLIER_LIMITS.LEAD_TIME_MAX_DAYS)
      .optional(),
    minimum_order: z.number().min(0).optional(),
    rating: z.number()
      .int()
      .min(SUPPLIER_LIMITS.RATING_MIN)
      .max(SUPPLIER_LIMITS.RATING_MAX)
      .optional(),
    is_active: z.boolean().optional(),
    notes: z.string()
      .max(SUPPLIER_LIMITS.NOTES_MAX_LENGTH)
      .trim()
      .optional(),
  }),
  params: z.object({
    id: z.preprocess(val => Number(val), z.number().int().positive('Invalid supplier ID format')),
  }),
})

export const supplierIdSchema = z.object({
  params: z.object({
    id: z.preprocess(val => Number(val), z.number().int().positive('Invalid supplier ID format')),
  }),
})

export const supplierListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().trim().optional(),
    supplier_type: z.enum(VALID_SUPPLIER_TYPES as [string, ...string[]]).optional(),
    is_active: z.preprocess(val => val === 'true' || val === true, z.boolean()).optional(),
    sort_by: z.string().optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
  }),
})