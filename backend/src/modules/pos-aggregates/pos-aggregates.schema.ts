// backend/src/modules/pos-aggregates/pos-aggregates.schema.ts

import { z } from 'zod'
import type { AggregatedTransactionStatus } from './pos-aggregates.types'

/**
 * Common numeric amount schema.
 * - Non-negative
 * - 2-decimal rounding at domain level
 */
const amountSchema = z
  .number()
  .finite()
  .refine((v) => v >= 0, { message: 'Amount must be zero or positive' })
  .transform((v) => Number(v.toFixed(2)))

/**
 * Aggregation source type
 */
export const aggregatedTransactionSourceTypeSchema = z.enum(['POS'])

/**
 * Aggregated transaction lifecycle status
 */
export const aggregatedTransactionStatusSchema = z.enum(
  ['READY', 'JOURNALIZED', 'POSTED', 'ERROR', 'SPLIT', 'REFUNDED', 'VOIDED', 'RECONCILED', 'DELETED'] as const
)

/**
 * Schema for creating aggregated transaction
 */
export const createAggregatedTransactionSchema = z
  .object({
    company_id: z.string().uuid(),
    branch_id: z.string().uuid().nullish(),

    source_type: aggregatedTransactionSourceTypeSchema.default('POS'),
    source_id: z.string().uuid(),
    source_ref: z.string().min(1).max(100),

    transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: 'transaction_date must be in YYYY-MM-DD format',
    }),

    payment_method_id: z.number().int().positive(),

    gross_amount: amountSchema,
    discount_amount: amountSchema.default(0),
    tax_amount: amountSchema.default(0),
    service_charge_amount: amountSchema.default(0),
    net_amount: amountSchema,

    currency: z.string().length(3).default('IDR'),

    // Optional for split/refund tracking
    parent_id: z.string().uuid().nullish(),
    split_sequence: z.number().int().positive().nullish(),
    split_total: z.number().int().positive().nullish(),
    original_net_amount: amountSchema.nullish(),
    refund_type: z.enum(['FULL', 'PARTIAL']).nullish(),
    refund_reason: z.string().max(1000).nullish(),
    refund_approved_by: z.string().uuid().nullish(),
    refund_approved_at: z.string().nullish(),
  })
  .superRefine((data, ctx) => {
    /**
     * Business invariant:
     * Net amount calculation must match formula
     * Net = Gross - Discount - Tax - Service
     */
    const calculatedNet =
      data.gross_amount -
      data.discount_amount -
      data.tax_amount -
      data.service_charge_amount

    if (Math.abs(data.net_amount - calculatedNet) > 0.01) {
      ctx.addIssue({
        path: ['net_amount'],
        message: 'net_amount calculation mismatch',
        code: z.ZodIssueCode.custom,
      })
    }
  })

/**
 * Schema for updating aggregated transaction state
 */
export const updateAggregatedTransactionSchema = z.object({
  status: aggregatedTransactionStatusSchema.optional(),
  journal_id: z.string().uuid().nullish(),
  error_message: z.string().max(2000).nullish(),
  split_count: z.number().int().optional(),
  split_total_amount: amountSchema.optional(),
  void_reason: z.string().max(1000).nullish(),
  voided_by: z.string().uuid().nullish(),
  voided_at: z.string().nullish(),
  refund_reason: z.string().max(1000).nullish(),
  refund_approved_by: z.string().uuid().nullish(),
  refund_approved_at: z.string().nullish(),
  is_reconciled: z.boolean().optional(),
})

/**
 * Reusable amount consistency checker
 */
export const validateAmountConsistency = (data: {
  gross_amount: number
  discount_amount: number
  tax_amount: number
  service_charge_amount: number
  net_amount: number
}): boolean => {
  const calculatedNet =
    data.gross_amount -
    data.discount_amount -
    data.tax_amount -
    data.service_charge_amount

  return Math.abs(data.net_amount - calculatedNet) <= 0.01
}

/**
 * List query schema for aggregated transactions
 */
export const listAggregatedTransactionsSchema = z.object({
  query: z.object({
    company_id: z.string().uuid(),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: aggregatedTransactionStatusSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
})

/**
 * Path parameters schema for single transaction
 */
export const aggregatedTransactionIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

