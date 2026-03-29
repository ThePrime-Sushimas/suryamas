/**
 * Fee Reconciliation Schemas
 * Zod validation schemas for API requests/responses
 */

import { z } from 'zod'
import type { 
  ReconcileDailyRequest, 
  DailySummaryQuery,
  FeeDiscrepancyParams 
} from './fee-reconciliation.types'

// ========================================
// REQUEST SCHEMAS
// ========================================

/** Reconcile daily fees */
export const reconcileDailySchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  tolerancePercentage: z.number().min(0).max(10).optional().default(1),
})

export type ReconcileDailyRequestSchema = z.infer<typeof reconcileDailySchema>


/** Get daily summary */
export const dailySummaryQuerySchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
})

export type DailySummaryQuerySchema = z.infer<typeof dailySummaryQuerySchema>

/** Fee discrepancy calculation params (internal bank-recon call) */
export const feeDiscrepancyParamsSchema = z.object({
  aggregateId: z.string().uuid('Invalid aggregate ID'),
  statementId: z.string().uuid('Invalid statement ID'),
})

export const feeDiscrepancyMultiParamsSchema = z.object({
  aggregateId: z.string().uuid('Invalid aggregate ID'),
  totalBankAmount: z.number().finite(),
})

export type FeeDiscrepancyParamsSchema = z.infer<typeof feeDiscrepancyParamsSchema>

// ========================================
// RESPONSE SCHEMAS
// ========================================

/** Generic success response */
export const successResponseSchema = z.object({
  success: z.literal(true),
})

/** Reconciliation result */
export const reconciliationResultSchema = z.object({
  paymentMethodId: z.number(),
  paymentMethodCode: z.string(),
  paymentMethodName: z.string(),
  date: z.string().datetime(),
  totalGross: z.number().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
  percentageFee: z.number().nonnegative(),
  fixedFee: z.number().nonnegative(), 
  totalFee: z.number().nonnegative(),
  expectedNet: z.number(),
  actualFromBank: z.number().nonnegative(),
  difference: z.number(),
  marketingFee: z.number().nonnegative(),
  isWithinTolerance: z.boolean(),
  needsReview: z.boolean(),
})

/** Daily reconciliation summary */
export const dailySummaryResponseSchema = z.object({
  date: z.string().datetime(),
  totalSettlements: z.number().int().nonnegative(),
  totalGrossAmount: z.number().nonnegative(),
  totalExpectedNet: z.number(),
  totalActualFromBank: z.number().nonnegative(),
  totalMarketingFee: z.number().nonnegative(),
  matchedCount: z.number().int().nonnegative(),
  discrepancyCount: z.number().int().nonnegative(),
  needsReviewCount: z.number().int().nonnegative(),
  results: z.array(reconciliationResultSchema),
})


/** Batch operation result */
export const batchResultSchema = z.object({
  success: z.boolean(),
  processed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z.array(z.string()).optional(),
})

// ========================================
// PUBLIC API
// ========================================

export const schemas = {
  reconcileDaily: reconcileDailySchema,
  dailySummaryQuery: dailySummaryQuerySchema,
  feeDiscrepancyParams: feeDiscrepancyParamsSchema,
  dailySummaryResponse: dailySummaryResponseSchema,
} as const

