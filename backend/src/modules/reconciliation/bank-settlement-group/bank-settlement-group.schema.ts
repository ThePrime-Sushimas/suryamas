import { z } from "zod";
import { bankSettlementConfig } from "./bank-settlement-group.config";

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
 * Zod schemas for Bank Settlement Group module
 * Note: companyId is handled by branch context middleware, not required in request
 */

/**
 * Schema for create settlement group request (BULK SETTLEMENT)
 */
export const createSettlementGroupSchema = z.object({
  body: z.object({
    bankStatementId: z.coerce.string().min(1, "Bank Statement ID is required"),
    aggregateIds: z.array(
      z.string().min(1, "Aggregate ID is required"),
      { message: "Aggregate IDs are required" }
    )
      .min(1, "At least one aggregate ID is required")
      .transform((ids) => [...new Set(ids)]), // Remove duplicates
    notes: z.string().max(500).optional(),
    overrideDifference: z.boolean().optional().default(false),
  }),
});

/**
 * Schema for settlement group list query
 */
export const getSettlementGroupListSchema = z.object({
  query: z.object({
    startDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
    endDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
    status: z.enum(['PENDING', 'RECONCILED', 'DISCREPANCY']).optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(bankSettlementConfig.maxPageSize).optional().default(bankSettlementConfig.defaultPageSize),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

/**
 * Schema for undo settlement group request
 */
export const undoSettlementGroupSchema = z.object({
  params: z.object({
    id: z.coerce.string().min(1, "Settlement Group ID is required"),
  }),
});

/**
 * Schema for get settlement group by ID
 */
export const getSettlementGroupByIdSchema = z.object({
  params: z.object({
    id: z.coerce.string().min(1, "Settlement Group ID is required"),
  }),
});

/**
 * Schema for get aggregates in settlement group
 */
export const getSettlementGroupAggregatesSchema = z.object({
  params: z.object({
    id: z.coerce.string().min(1, "Settlement Group ID is required"),
  }),
});

/**
 * Schema for get available aggregates query
 */
export const getAvailableAggregatesSchema = z.object({
  query: z.object({
    startDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
    endDate: datetimeFormat.optional().or(z.literal('').transform(() => undefined)),
    bankAccountId: z.coerce.number().int().positive().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50000).optional().default(10000),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),
});

/**
 * Schema for get suggestions query
 */
export const getSuggestionsSchema = z.object({
  query: z.object({
    targetAmount: z.coerce.number().min(0, "Target amount must be positive"),
    tolerancePercent: z.coerce.number().min(0).max(1).optional().default(bankSettlementConfig.suggestionDefaultTolerance),
    dateToleranceDays: z.coerce.number().int().min(0).max(30).optional().default(2),
    maxResults: z.coerce.number().int().min(1).max(bankSettlementConfig.suggestionMaxResults).optional().default(bankSettlementConfig.suggestionMaxResults),
  }),
});

export type CreateSettlementGroupInput = z.infer<typeof createSettlementGroupSchema>;
export type GetSettlementGroupListInput = z.infer<typeof getSettlementGroupListSchema>;
export type UndoSettlementGroupInput = z.infer<typeof undoSettlementGroupSchema>;
export type GetSettlementGroupByIdInput = z.infer<typeof getSettlementGroupByIdSchema>;
export type GetSettlementGroupAggregatesInput = z.infer<typeof getSettlementGroupAggregatesSchema>;
export type GetAvailableAggregatesInput = z.infer<typeof getAvailableAggregatesSchema>;
export type GetSuggestionsInput = z.infer<typeof getSuggestionsSchema>;
