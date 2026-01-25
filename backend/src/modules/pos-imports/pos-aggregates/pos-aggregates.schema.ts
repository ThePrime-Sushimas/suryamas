import { z } from '@/lib/openapi'

/**
 * Schema for creating aggregated transactions
 * Data sourced from: pos_import_lines
 * 
 * Field mapping:
 * - source_id: pos_import_id
 * - source_ref: bill_number
 * - transaction_date: sales_date
 * - payment_method_id: payment_method (lookup required)
 * - gross_amount: subtotal
 * - discount_amount: discount + bill_discount
 * - tax_amount: tax
 * - service_charge_amount: service_charge
 * - net_amount: subtotal + tax + service_charge - (discount + bill_discount)
 */
/**
 * Payment method input - can be ID (number) or name (string)
 */
const paymentMethodIdSchema = z.union([
  z.number().int().positive('Payment method ID must be a positive integer'),
  z.string().min(1, 'Payment method name cannot be empty'),
])

export const createAggregatedTransactionSchema = z.object({
  body: z.object({
    branch_name: z.string().nullable().optional(),  // branch name from pos_import_lines
    source_type: z.enum(['POS']).default('POS'),
    source_id: z.string().min(1, 'Source ID is required').max(100, 'Source ID must not exceed 100 characters'),
    source_ref: z.string().min(1, 'Source reference is required').max(100, 'Source reference must not exceed 100 characters'),
    transaction_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Transaction date must be a valid date string',
    }),
    payment_method_id: paymentMethodIdSchema,
    gross_amount: z.number().min(0, 'Gross amount must be non-negative'),
    discount_amount: z.number().min(0, 'Discount amount must be non-negative').default(0),
    tax_amount: z.number().min(0, 'Tax amount must be non-negative').default(0),
    service_charge_amount: z.number().min(0, 'Service charge amount must be non-negative').default(0),
    net_amount: z.number().min(0, 'Net amount must be non-negative'),
    currency: z.string().min(1, 'Currency is required').max(10).default('IDR'),
    status: z.enum(['READY', 'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'])
      .default('READY'),
  }),
})

/**
 * Schema for updating aggregated transactions
 */
export const updateAggregatedTransactionSchema = z.object({
  body: z.object({
    branch_name: z.string().nullable().optional(),
    source_type: z.enum(['POS']).optional(),
    source_id: z.string().min(1).max(100).optional(),
    source_ref: z.string().min(1).max(100).optional(),
    transaction_date: z.string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Transaction date must be a valid date string',
      })
      .optional(),
    payment_method_id: z.number().int().positive().optional(),
    gross_amount: z.number().min(0).optional(),
    discount_amount: z.number().min(0).optional(),
    tax_amount: z.number().min(0).optional(),
    service_charge_amount: z.number().min(0).optional(),
    net_amount: z.number().min(0).optional(),
    currency: z.string().min(1).max(10).optional(),
    status: z.enum(['READY', 'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'])
      .optional(),
    is_reconciled: z.boolean().optional(),
    version: z.number().int().positive().optional(),
  }),
  params: z.object({
    id: z.string().uuid('ID must be a valid UUID'),
  }),
})

/**
 * Schema for aggregated transaction ID parameter
 */
export const aggregatedTransactionIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID must be a valid UUID'),
  }),
})

/**
 * Schema for listing aggregated transactions query
 */
// Custom schema that accepts either a comma-separated string or an array of strings
const branchNamesSchema = z.union([
  z.string(),  // Comma-separated string
  z.array(z.string()),  // Array of strings
]).optional()

const paymentMethodIdsSchema = z.union([
  z.string(),  // Comma-separated string
  z.array(z.coerce.number().int().positive()),  // Array of numbers (coerced)
]).optional()

export const aggregatedTransactionListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    company_id: z.string().uuid().optional(),
    branch_name: z.string().optional(),
    branch_names: branchNamesSchema,
    source_type: z.enum(['POS']).optional(),
    source_id: z.string().optional(),
    payment_method_id: z.coerce.number().int().positive().optional(),
    payment_method_ids: paymentMethodIdsSchema,
    transaction_date: z.string().optional(),
    transaction_date_from: z.string().optional(),
    transaction_date_to: z.string().optional(),
    status: z.enum(['READY', 'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED']).optional(),
    is_reconciled: z.coerce.boolean().optional(),
    has_journal: z.coerce.boolean().optional(),
    search: z.string().optional(),
    show_deleted: z.coerce.boolean().default(false),
  }),
})

/**
 * Schema for generating journal from aggregated transactions
 */
export const generateJournalSchema = z.object({
  body: z.object({
    transaction_ids: z.array(z.string().uuid()).optional(),
    transaction_date_from: z.string().optional(),
    transaction_date_to: z.string().optional(),
    branch_name: z.string().optional(),
    payment_method_id: z.number().int().positive().optional(),
    include_unreconciled_only: z.boolean().default(false),
    total_amount: z.number().optional(), // internal use only
  }),
})

/**
 * Schema for batch reconciliation of aggregated transactions
 */
export const batchReconcileSchema = z.object({
  body: z.object({
    transaction_ids: z.array(z.string().uuid(), {
      message: 'Transaction IDs must be valid UUIDs',
    }).min(1, 'At least one transaction ID is required'),
    reconciled_by: z.string().min(1, 'Reconciled by is required'),
  }),
})

/**
 * Schema for aggregation query (aggregating from pos_import_lines)
 */
export const aggregateFromImportSchema = z.object({
  body: z.object({
    pos_import_id: z.string().min(1, 'POS import ID is required'),
    branch_name: z.string().nullable().optional(),
  }),
})

/**
 * Schema for aggregated transaction import row (Excel template)
 */
export const aggregatedTransactionImportRowSchema = z.object({
  source_type: z.enum(['POS']),
  source_id: z.string().min(1).max(100),
  source_ref: z.string().min(1).max(100),
  transaction_date: z.string(),
  payment_method_code: z.string().min(1),
  gross_amount: z.number().min(0),
  discount_amount: z.number().min(0).optional(),
  tax_amount: z.number().min(0).optional(),
  service_charge_amount: z.number().min(0).optional(),
  net_amount: z.number().min(0),
  currency: z.string().optional(),
})

/**
 * Schema for filter params (internal use)
 */
export const aggregatedTransactionFilterSchema = z.object({
  company_id: z.string().uuid().optional(),
  branch_name: z.string().nullable().optional(),
  source_type: z.string().optional(),
  source_id: z.string().optional(),
  payment_method_id: z.number().int().positive().optional(),
  transaction_date: z.string().optional(),
  transaction_date_from: z.string().optional(),
  transaction_date_to: z.string().optional(),
  status: z.enum(['READY', 'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED']).optional(),
  is_reconciled: z.boolean().optional(),
  has_journal: z.boolean().optional(),
  search: z.string().optional(),
  show_deleted: z.boolean().default(false),
})

/**
 * Schema for sort params (internal use)
 */
export const aggregatedTransactionSortSchema = z.object({
  field: z.enum(['transaction_date', 'gross_amount', 'net_amount', 'created_at', 'updated_at']),
  order: z.enum(['asc', 'desc']),
})

/**
 * Schema for batch creating aggregated transactions
 */
export const createBatchSchema = z.object({
  body: z.object({
    transactions: z.array(createAggregatedTransactionSchema.shape.body, {
      message: 'Transactions must be an array of valid transaction objects',
    }).min(1, 'At least one transaction is required'),
  }),
})

/**
 * Schema for batch assigning journals to transactions
 */
export const batchAssignJournalSchema = z.object({
  body: z.object({
    transaction_ids: z.array(z.string().uuid(), {
      message: 'Transaction IDs must be valid UUIDs',
    }).min(1, 'At least one transaction ID is required'),
    journal_id: z.string().uuid('Journal ID must be a valid UUID'),
  }),
})
