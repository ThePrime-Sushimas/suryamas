import { z } from "zod";

/**
 * Custom datetime schema that accepts both:
 * - ISO 8601 datetime format (e.g., "2025-01-15T00:00:00.000Z")
 * - Simple date format (e.g., "2025-01-15")
 */
const datetimeFormat = z.string().refine(
  (val) => {
    // Check if it's a valid ISO datetime or simple date format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      // ISO datetime format
      return !isNaN(Date.parse(val));
    }
    // Simple date format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return !isNaN(Date.parse(val + 'T00:00:00.000Z'));
    }
    return false;
  },
  {
    message: "Invalid date format. Expected ISO datetime (YYYY-MM-DDTHH:mm:ss.sssZ) or simple date (YYYY-MM-DD)",
  }
).transform((val) => {
  // Normalize to ISO datetime format
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val + 'T00:00:00.000Z';
  }
  return val;
});

/**
 * Simple date schema that accepts both date and datetime formats
 */
const dateFormat = z.string().refine(
  (val) => {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      return !isNaN(Date.parse(val));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return !isNaN(Date.parse(val + 'T00:00:00.000Z'));
    }
    return false;
  },
  {
    message: "Invalid date format. Expected YYYY-MM-DD or ISO datetime",
  }
).transform((val) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val + 'T00:00:00.000Z';
  }
  return val;
});

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
    startDate: dateFormat,
    endDate: dateFormat,
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
    startDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
    endDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
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
    startDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
    endDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
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
      z.string().min(1, "Statement ID is required"),
      { message: "Statement IDs are required" }
    )
      .min(1, "At least one statement ID is required")
      .transform((ids) => [...new Set(ids)]), // Remove duplicates
    notes: z.string().max(500).optional(),
    overrideDifference: z.boolean().optional().default(false),
  }),
});

/**
 * Schema for multi-match groups query - dates are optional
 */
export const multiMatchGroupQuerySchema = z.object({
  query: z.object({
    startDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
    endDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
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

// =====================================================
// AUTO-MATCH PREVIEW & CONFIRM SCHEMAS
// =====================================================

/**
 * Schema for auto-match preview request (returns matches without updating)
 */
export const autoMatchPreviewSchema = z.object({
  body: z.object({
    startDate: dateFormat,
    endDate: dateFormat,
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
 * Schema for auto-match confirm request (reconciles selected statements)
 */
export const autoMatchConfirmSchema = z.object({
  body: z.object({
    statementIds: z.array(
      z.string().min(1, "Statement ID is required"),
      { message: "Statement IDs are required" }
    ).min(1, "At least one statement ID is required"),
    matchingCriteria: z
      .object({
        amountTolerance: z.number().min(0).optional(),
        dateBufferDays: z.number().int().min(0).max(30).optional(),
        differenceThreshold: z.number().min(0).optional(),
      })
      .optional(),
  }),
});

export type AutoMatchPreviewInput = z.infer<typeof autoMatchPreviewSchema>;
export type AutoMatchConfirmInput = z.infer<typeof autoMatchConfirmSchema>;
