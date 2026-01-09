// backend/src/modules/payment-terms/payment-terms.schema.ts

import { z } from '@/lib/openapi'
import { VALID_CALCULATION_TYPES, PAYMENT_TERM_LIMITS } from './payment-terms.constants'

export const createPaymentTermSchema = z.object({
  body: z.object({
    term_code: z.string().min(1).max(PAYMENT_TERM_LIMITS.TERM_CODE_MAX_LENGTH),
    term_name: z.string().min(1).max(PAYMENT_TERM_LIMITS.TERM_NAME_MAX_LENGTH),
    calculation_type: z.enum(VALID_CALCULATION_TYPES as [string, ...string[]]).optional(),
    days: z.number().int().min(0).optional(),
    payment_dates: z.array(z.number().int().min(1)).nullish(),
    payment_day_of_week: z.number().int().min(1).max(7).nullish(),
    early_payment_discount: z.number().min(0).max(PAYMENT_TERM_LIMITS.MAX_DISCOUNT_PERCENT).optional(),
    early_payment_days: z.number().int().min(0).optional(),
    late_payment_penalty: z.number().min(0).max(PAYMENT_TERM_LIMITS.MAX_PENALTY_PERCENT).optional(),
    grace_period_days: z.number().int().min(0).optional(),
    minimum_order_amount: z.number().min(0).optional(),
    maximum_order_amount: z.number().min(0).nullish(),
    allowed_payment_methods: z.array(z.string()).nullish(),
    requires_guarantee: z.boolean().optional(),
    guarantee_type: z.string().max(PAYMENT_TERM_LIMITS.GUARANTEE_TYPE_MAX_LENGTH).optional(),
    seasonal_terms: z.any().optional(),
    volume_discount_tiers: z.any().optional(),
    is_active: z.boolean().optional(),
    description: z.string().nullish(),
  }),
})

export const updatePaymentTermSchema = z.object({
  body: z.object({
    term_name: z.string().min(1).max(PAYMENT_TERM_LIMITS.TERM_NAME_MAX_LENGTH).optional(),
    calculation_type: z.enum(VALID_CALCULATION_TYPES as [string, ...string[]]).optional(),
    days: z.number().int().min(0).optional(),
    payment_dates: z.array(z.number().int().min(1)).nullish(),
    payment_day_of_week: z.number().int().min(1).max(7).nullish(),
    early_payment_discount: z.number().min(0).max(PAYMENT_TERM_LIMITS.MAX_DISCOUNT_PERCENT).optional(),
    early_payment_days: z.number().int().min(0).optional(),
    late_payment_penalty: z.number().min(0).max(PAYMENT_TERM_LIMITS.MAX_PENALTY_PERCENT).optional(),
    grace_period_days: z.number().int().min(0).optional(),
    minimum_order_amount: z.number().min(0).optional(),
    maximum_order_amount: z.number().min(0).nullish(),
    allowed_payment_methods: z.array(z.string()).nullish(),
    requires_guarantee: z.boolean().optional(),
    guarantee_type: z.string().max(PAYMENT_TERM_LIMITS.GUARANTEE_TYPE_MAX_LENGTH).optional(),
    seasonal_terms: z.any().optional(),
    volume_discount_tiers: z.any().optional(),
    is_active: z.boolean().optional(),
    description: z.string().nullish(),
  }).refine((data) => !('term_code' in data), {
    message: 'Term code cannot be updated',
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid payment term ID format'),
  }),
})

export const paymentTermIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'Invalid payment term ID format'),
  }),
})
