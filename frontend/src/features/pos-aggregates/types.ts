/**
 * pos-aggregates.types.ts
 *
 * Type definitions for pos-aggregates feature module.
 * These types are designed to match the backend API response structure exactly.
 * All types follow the production-ready standards for type safety and maintainability.
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Status of aggregated transaction in the system
 * Maps to: public.aggregated_transaction_status
 */
export type AggregatedTransactionStatus =
  | "READY"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

/**
 * Source types for aggregated transactions
 * Maps to: source_type character varying(30) default 'POS'
 */
export type AggregatedTransactionSourceType = "POS";

/**
 * Main aggregated transaction interface
 * Represents aggregated POS transaction data ready for journal entry generation
 * Maps to: public.aggregated_transactions table
 */
export interface AggregatedTransaction {
  id: string;
  branch_name: string | null;
  source_type: AggregatedTransactionSourceType;
  source_id: string;
  source_ref: string;
  transaction_date: string;
  payment_method_id: number;
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  service_charge_amount: number;
  bill_after_discount: number;
  percentage_fee_amount: number;
  fixed_fee_amount: number;
  total_fee_amount: number;
  nett_amount: number;
  currency: string;
  journal_id: string | null;
  is_reconciled: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  version: number;
  status: AggregatedTransactionStatus;
  failed_reason: string | null;
  failed_at: string | null;
}

/**
 * Aggregated transaction with related details (joined tables)
 */
export interface AggregatedTransactionWithDetails extends AggregatedTransaction {
  company_code?: string;
  company_name?: string;
  branch_code?: string;
  payment_method_code?: string;
  payment_method_name?: string;
  journal_number?: string;
  journal_status?: string;
  // Bank mutation / reconciliation details
  bank_mutation_id?: string | null;
  bank_mutation_date?: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  reconciled_at?: string | null;
  reconciled_by?: string | null;
}

/**
 * Aggregated transaction for list views (lightweight)
 * Excludes unnecessary fields for table display
 */
export interface AggregatedTransactionListItem {
  id: string;
  branch_name: string | null;
  source_type: AggregatedTransactionSourceType;
  source_id: string;
  source_ref: string;
  transaction_date: string;
  payment_method_id: number;
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  service_charge_amount: number;
  bill_after_discount: number;
  percentage_fee_amount: number;
  fixed_fee_amount: number;
  total_fee_amount: number;
  nett_amount: number;
  currency: string;
  journal_id: string | null;
  is_reconciled: boolean;
  status: AggregatedTransactionStatus;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  version: number;
  payment_method_name?: string;
  journal_number?: string;
  failed_reason?: string | null;
  failed_at?: string | null;
}

// =============================================================================
// DTO TYPES (Data Transfer Objects for API requests)
// =============================================================================

/**
 * DTO for creating a new aggregated transaction
 * All fields are optional except the required ones
 */
export interface CreateAggregatedTransactionDto {
  branch_name?: string | null;
  source_type?: AggregatedTransactionSourceType;
  source_id: string;
  source_ref: string;
  transaction_date: string;
  payment_method_id: number | string;
  gross_amount: number;
  discount_amount?: number;
  tax_amount?: number;
  service_charge_amount?: number;
  bill_after_discount?: number;
  percentage_fee_amount?: number;
  fixed_fee_amount?: number;
  total_fee_amount?: number;
  nett_amount: number;
  currency?: string;
  status?: AggregatedTransactionStatus;
}

/**
 * DTO for updating an aggregated transaction
 * Partial update - all fields are optional
 */
export interface UpdateAggregatedTransactionDto {
  branch_name?: string | null;
  source_type?: AggregatedTransactionSourceType;
  source_id?: string;
  source_ref?: string;
  transaction_date?: string;
  payment_method_id?: number | string;
  gross_amount?: number;
  discount_amount?: number;
  tax_amount?: number;
  service_charge_amount?: number;
  bill_after_discount?: number;
  percentage_fee_amount?: number;
  fixed_fee_amount?: number;
  total_fee_amount?: number;
  nett_amount?: number;
  currency?: string;
  status?: AggregatedTransactionStatus;
  is_reconciled?: boolean;
  version?: number;
}

/**
 * DTO for batch creating aggregated transactions
 */
export interface CreateBatchAggregatedTransactionDto {
  transactions: CreateAggregatedTransactionDto[];
}

/**
 * DTO for batch reconciliation
 */
export interface BatchReconcileDto {
  transaction_ids: string[];
  reconciled_by: string;
}

/**
 * DTO for batch assign journal
 */
export interface BatchAssignJournalDto {
  transaction_ids: string[];
  journal_id: string;
}

/**
 * DTO for generating journal entries
 */
export interface GenerateJournalDto {
  transaction_ids?: string[];
  transaction_date_from?: string;
  transaction_date_to?: string;
  branch_name?: string;
  payment_method_id?: number;
  include_unreconciled_only?: boolean;
}

/**
 * DTO for assigning journal to single transaction
 */
export interface AssignJournalDto {
  journal_id: string;
}

// =============================================================================
// FILTER & PAGINATION TYPES
// =============================================================================

/**
 * Query parameters for listing aggregated transactions
 * Maps to backend aggregatedTransactionListQuerySchema
 */
export interface AggregatedTransactionFilterParams {
  page?: number;
  limit?: number;
  company_id?: string;
  branch_name?: string | null;
  branch_names?: string[] | string; // Multiple branches (checkbox method) - also accepts comma-separated string
  source_type?: AggregatedTransactionSourceType;
  source_id?: string;
  payment_method_id?: number;
  payment_method_ids?: number[] | string; // Multiple payment methods - also accepts comma-separated string
  transaction_date?: string;
  transaction_date_from?: string;
  transaction_date_to?: string;
  status?: AggregatedTransactionStatus;
  is_reconciled?: boolean;
  has_journal?: boolean;
  search?: string;
  show_deleted?: boolean;
}

/**
 * Sort parameters for aggregated transactions
 */
export interface AggregatedTransactionSortParams {
  field:
    | "transaction_date"
    | "gross_amount"
    | "nett_amount"
    | "created_at"
    | "updated_at";
  order: "asc" | "desc";
}

/**
 * Pagination metadata returned from API
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// =============================================================================
// SUMMARY & STATISTICS TYPES
// =============================================================================

/**
 * Summary statistics for aggregated transactions
 */
export interface AggregatedTransactionSummary {
  total_count: number;
  total_gross_amount: number;
  total_discount_amount: number;
  total_tax_amount: number;
  total_service_charge_amount: number;
  total_bill_after_discount: number;
  total_percentage_fee_amount: number;
  total_fixed_fee_amount: number;
  total_fee_amount: number;
  total_nett_amount: number;
  by_status?: Record<AggregatedTransactionStatus, number>;
  by_payment_method?: Record<number, number>;
}

/**
 * Batch operation result
 */
export interface AggregatedTransactionBatchResult {
  success: string[];
  failed: Array<{ source_ref: string; error: string }>;
  total_processed: number;
}

/**
 * Batch assign journal result
 */
export interface BatchAssignJournalResult {
  assigned: number;
  skipped: number;
}

/**
 * Reconciliation result
 */
export interface AggregatedTransactionReconciliationResult {
  transaction_id: string;
  previous_reconciled_state: boolean;
  new_reconciled_state: boolean;
  reconciled_at: string;
  reconciled_by: string;
}

/**
 * Journal generation result
 */
export interface JournalGenerationResult {
  date: string;
  transaction_ids: string[];
  journal_id: string | null;
  total_amount: number;
  journal_number?: string;
}

// =============================================================================
// FORM TYPES
// =============================================================================

/**
 * Batch transaction form data
 */
export interface BatchTransactionFormData {
  transactions: CreateAggregatedTransactionDto[];
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Backend API response wrapper (matches sendSuccess format)
 */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: PaginationMeta;
}

/**
 * List params for API calls
 */
export interface ListParams {
  page: number;
  limit: number;
  sort?: string;
  order?: "asc" | "desc";
  [key: string]: unknown;
}

/**
 * Payment method option for dropdowns
 */
export interface PaymentMethodOption {
  id: number;
  code: string;
  name: string;
}

/**
 * Branch option for dropdowns
 */
export interface BranchOption {
  id: string;
  branch_name: string;
}

/**
 * Journal option for dropdowns
 */
export interface JournalOption {
  id: string;
  journal_number: string;
  journal_date: string;
  total_amount: number;
}
