import { z } from "zod";

/**
 * Zod schemas for Bank Reconciliation module
 * Note: companyId is handled by branch context middleware, not required in request
 */

/**
 * Schema for manual reconciliation request
 */
export const manualReconcileSchema = z.object({
  body: z.object({
    aggregateId: z.coerce.string().min(1, "Aggregate ID is required"),
    statementId: z.coerce.string().min(1, "Statement ID is required"),
    notes: z.string().max(500).optional(),
    overrideDifference: z.boolean().optional().default(false),
  }),
});

/**
 * Schema for auto-matching request
 */
export const autoMatchSchema = z.object({
  body: z.object({
    startDate: z.string().date("Invalid start date format"),
    endDate: z.string().date("Invalid end date format"),
    bankAccountId: z.number().int().positive().optional(),
    matchingCriteria: z
      .object({
        amountTolerance: z.number().min(0).optional(),
        dateBufferDays: z.number().int().min(0).max(30).optional(),
        differenceThreshold: z.number().min(0).optional(),
      })
      .optional(),
  }),
});

/**
 * Schema for bank statements query
 * Dates are optional - when not provided, queries overall date range across all imports
 */
export const getStatementsQuerySchema = z.object({
  query: z.object({
    // Optional date range - queries overall date range when not provided
    startDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
    endDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
    // Bank account filter
    bankAccountId: z.coerce.number().int().positive().optional(),
    // Status filter (RECONCILED, UNRECONCILED, DISCREPANCY)
    status: z.enum(['RECONCILED', 'UNRECONCILED', 'DISCREPANCY']).optional(),
    // Search filter
    search: z.string().optional(),
    // Reconciliation status filter (alias for status)
    isReconciled: z.coerce.boolean().optional(),
    // Pagination - allow larger limit for showing all data
    limit: z.coerce.number().int().min(1).max(50000).optional().default(10000),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

/**
 * Schema for summary query - dates are optional
 */
export const getSummaryQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
    endDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
  }),
});

export type ManualReconcileInput = z.infer<typeof manualReconcileSchema>;
export type AutoMatchInput = z.infer<typeof autoMatchSchema>;
export type GetStatementsQueryInput = z.infer<typeof getStatementsQuerySchema>;
export type GetSummaryQueryInput = z.infer<typeof getSummaryQuerySchema>;

// =====================================================
// MULTI-MATCH SCHEMAS
// =====================================================

/**
 * Schema for multi-match request
 */
export const multiMatchSchema = z.object({
  body: z.object({
    aggregateId: z.coerce.string().min(1, "Aggregate ID is required"),
    statementIds: z.array(
      z.string().uuid("Statement ID must be a valid UUID"),
      { message: "Statement IDs must be valid UUIDs" }
    ).min(1, "At least one statement ID is required"),
    notes: z.string().max(500).optional(),
    overrideDifference: z.boolean().optional().default(false),
  }),
});

/**
 * Schema for multi-match groups query - dates are optional
 */
export const multiMatchGroupQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
    endDate: z.string().datetime().optional().or(z.literal('').transform(() => undefined)),
  }),
});

/**
 * Schema for suggestions query
 */
export const multiMatchSuggestionsQuerySchema = z.object({
  query: z.object({
    aggregateId: z.coerce.string().min(1, "Aggregate ID is required"),
    tolerancePercent: z.coerce.number().min(0).max(1).optional(),
    dateToleranceDays: z.coerce.number().int().min(0).max(30).optional(),
    maxStatements: z.coerce.number().int().min(1).max(20).optional(),
  }),
});

export type MultiMatchInput = z.infer<typeof multiMatchSchema>;
export type MultiMatchGroupQueryInput = z.infer<typeof multiMatchGroupQuerySchema>;
export type MultiMatchSuggestionsInput = z.infer<typeof multiMatchSuggestionsQuerySchema>;
