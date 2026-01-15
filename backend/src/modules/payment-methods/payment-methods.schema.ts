// payment-methods.schema.ts

import { z } from '@/lib/openapi'
import { PaymentMethodsConfig } from './payment-methods.errors'

const uuidSchema = z.string().uuid()
const paymentTypes = PaymentMethodsConfig.PAYMENT_TYPES

// ID parameter schema
export const paymentMethodIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid payment method ID format'),
  }),
})

// Create payment method schema
export const createPaymentMethodSchema = z.object({
  body: z.object({
    company_id: uuidSchema,
    code: z.string()
      .min(1, 'Code is required')
      .max(PaymentMethodsConfig.VALIDATION.CODE_MAX_LENGTH, `Code must not exceed ${PaymentMethodsConfig.VALIDATION.CODE_MAX_LENGTH} characters`)
      .toUpperCase(),
    name: z.string()
      .min(1, 'Name is required')
      .max(PaymentMethodsConfig.VALIDATION.NAME_MAX_LENGTH, `Name must not exceed ${PaymentMethodsConfig.VALIDATION.NAME_MAX_LENGTH} characters`),
    description: z.string()
      .max(PaymentMethodsConfig.VALIDATION.DESCRIPTION_MAX_LENGTH, `Description must not exceed ${PaymentMethodsConfig.VALIDATION.DESCRIPTION_MAX_LENGTH} characters`)
      .nullable()
      .optional(),
    payment_type: z.enum(paymentTypes as unknown as [string, ...string[]], {
      message: `Payment type must be one of: ${paymentTypes.join(', ')}`,
    }),
    bank_account_id: z.number().int().positive().nullable().optional(),
    coa_account_id: uuidSchema.nullable().optional(),
    is_default: z.boolean().optional().default(false),
    requires_bank_account: z.boolean().optional().default(false),
    sort_order: z.number().int().min(PaymentMethodsConfig.VALIDATION.MIN_SORT_ORDER).optional(),
  }),
})

// Update payment method schema
export const updatePaymentMethodSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid payment method ID format'),
  }),
  body: z.object({
    name: z.string()
      .min(1, 'Name is required')
      .max(PaymentMethodsConfig.VALIDATION.NAME_MAX_LENGTH, `Name must not exceed ${PaymentMethodsConfig.VALIDATION.NAME_MAX_LENGTH} characters`)
      .optional(),
    description: z.string()
      .max(PaymentMethodsConfig.VALIDATION.DESCRIPTION_MAX_LENGTH, `Description must not exceed ${PaymentMethodsConfig.VALIDATION.DESCRIPTION_MAX_LENGTH} characters`)
      .nullable()
      .optional(),
    payment_type: z.enum(paymentTypes as unknown as [string, ...string[]], {
      message: `Payment type must be one of: ${paymentTypes.join(', ')}`,
    }).optional(),
    bank_account_id: z.number().int().positive().nullable().optional(),
    coa_account_id: uuidSchema.nullable().optional(),
    is_active: z.boolean().optional(),
    is_default: z.boolean().optional(),
    requires_bank_account: z.boolean().optional(),
    sort_order: z.number().int().min(PaymentMethodsConfig.VALIDATION.MIN_SORT_ORDER).optional(),
  }),
})

// List query schema
export const paymentMethodListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    payment_type: z.enum(paymentTypes as unknown as [string, ...string[]]).optional(),
    is_active: z.coerce.boolean().optional(),
    requires_bank_account: z.coerce.boolean().optional(),
    search: z.string().optional(),
  }),
})

// Bulk update status schema
export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    ids: z.array(z.coerce.number())
      .min(1, 'At least one ID is required')
      .max(100, 'Cannot update more than 100 records at once'),
    is_active: z.boolean(),
  }),
})

// Bulk delete schema
export const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(z.coerce.number())
      .min(1, 'At least one ID is required')
      .max(100, 'Cannot delete more than 100 records at once'),
  }),
})

