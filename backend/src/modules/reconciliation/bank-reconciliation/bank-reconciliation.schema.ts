import { z } from 'zod';

/**
 * Zod schemas for Bank Reconciliation module
 */

/**
 * Schema for manual reconciliation request
 */
export const manualReconcileSchema = z.object({
  body: z.object({
    companyId: z.string().uuid('Invalid company ID'),
    aggregateId: z.coerce.string().min(1, 'Aggregate ID is required'),
    statementId: z.coerce.string().min(1, 'Statement ID is required'),
    notes: z.string().max(500).optional(),
    overrideDifference: z.boolean().optional().default(false),
  }),
});

/**
 * Schema for auto-matching request
 */
export const autoMatchSchema = z.object({
  body: z.object({
    companyId: z.string().uuid('Invalid company ID'),
    startDate: z.string().datetime({ message: 'Invalid start date format' }),
    endDate: z.string().datetime({ message: 'Invalid end date format' }),
    matchingCriteria: z.object({
      amountTolerance: z.number().min(0).optional(),
      dateBufferDays: z.number().int().min(0).max(30).optional(),
      differenceThreshold: z.number().min(0).optional(),
    }).optional(),
  }),
});

/**
 * Schema for discrepancy report query
 */
export const getDiscrepanciesQuerySchema = z.object({
  query: z.object({
    companyId: z.string().uuid('Invalid company ID'),
    date: z.string().date('Invalid date format (use YYYY-MM-DD)'),
    threshold: z.coerce.number().min(0).optional(),
  }),
});

/**
 * Schema for summary query
 */
export const getSummaryQuerySchema = z.object({
  query: z.object({
    companyId: z.string().uuid('Invalid company ID'),
    startDate: z.string().date('Invalid start date format'),
    endDate: z.string().date('Invalid end date format'),
  }),
});

export type ManualReconcileInput = z.infer<typeof manualReconcileSchema>;
export type AutoMatchInput = z.infer<typeof autoMatchSchema>;
export type GetDiscrepanciesQueryInput = z.infer<typeof getDiscrepanciesQuerySchema>;
export type GetSummaryQueryInput = z.infer<typeof getSummaryQuerySchema>;
