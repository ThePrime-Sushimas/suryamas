
import { JournalHeader } from '../../accounting/journals/journal-headers/journal-headers.types'

/**
 * Status of aggregated transaction in the system
 * Maps to: public.aggregated_transaction_status
 */
export type AggregatedTransactionStatus = 'READY' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'

/**
 * Source types for aggregated transactions
 * Maps to: source_type character varying(30) default 'POS'
 */
export type AggregatedTransactionSourceType = 'POS'

/**
 * Main aggregated transaction interface
 * Represents aggregated POS transaction data ready for journal entry generation
 * Maps to: public.aggregated_transactions table
 * 
 * Data Source: pos_import_lines table
 * 
 * Field Mapping from pos_import_lines:
 * | aggregated_transactions | pos_import_lines | Calculation |
 * |------------------------|------------------|-------------|
* | company_id | - | From user login context |
 * | branch_name | branch | Store branch name as string from pos_import_lines |
 * | source_type | - | Fixed: 'POS' |
 * | source_id | pos_import_id | ID of import batch |
 * | source_ref | bill_number | Bill number from POS |
 * | transaction_date | sales_date | Transaction date |
 * | payment_method_id | payment_method | Lookup payment_method code to get ID |
 * | gross_amount | subtotal | Gross sales before adjustments |
 * | discount_amount | discount + bill_discount | Total discount |
 * | tax_amount | tax | Tax amount |
 * | service_charge_amount | service_charge | Service charge amount |
 * | net_amount | - | subtotal + tax + service_charge - (discount + bill_discount) |
 * | currency | - | Fixed: 'IDR' |
 * | journal_id | - | Nullable, set when journal created |
 * | is_reconciled | - | Default: false |
 * | status | - | Default: 'READY' |
 * | version | - | Default: 1 |
 */
export interface AggregatedTransaction {
  id: string
  company_id: string
  branch_name: string | null  // Store branch name from pos_import_lines.branch
  source_type: AggregatedTransactionSourceType
  source_id: string  // pos_import_id from pos_import_lines
  source_ref: string  // bill_number from pos_import_lines
  transaction_date: string  // sales_date from pos_import_lines
  payment_method_id: number  // Lookup from payment_method using payment_method code
  gross_amount: number  // subtotal from pos_import_lines
  discount_amount: number  // discount + bill_discount from pos_import_lines
  tax_amount: number  // tax from pos_import_lines
  service_charge_amount: number  // service_charge from pos_import_lines
  net_amount: number  // subtotal + tax + service_charge - (discount + bill_discount)
  currency: string  // Default: 'IDR'
  journal_id: string | null
  is_reconciled: boolean  // Default: false
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null  // User who deleted the transaction
  version: number  // Default: 1
  status: AggregatedTransactionStatus  // Default: 'READY'
}

/**
 * Aggregated transaction with related details
 */
export interface AggregatedTransactionWithDetails extends AggregatedTransaction {
  company_code?: string
  company_name?: string
  branch_code?: string
  payment_method_code?: string
  payment_method_name?: string
  journal?: JournalHeader
}

/**
 * Aggregated transaction for list views (lightweight)
 */
export interface AggregatedTransactionListItem extends Pick<AggregatedTransaction,
  | 'id'
  | 'company_id'
  | 'source_type'
  | 'source_id'
  | 'source_ref'
  | 'transaction_date'
  | 'payment_method_id'
  | 'gross_amount'
  | 'discount_amount'
  | 'tax_amount'
  | 'service_charge_amount'
  | 'net_amount'
  | 'currency'
  | 'status'
  | 'is_reconciled'
  | 'created_at'
  | 'version'
> {
  company_name?: string
  branch_name?: string
  payment_method_name?: string
}

/**
 * DTO for creating a new aggregated transaction
 * Data sourced from pos_import_lines
 */
export interface CreateAggregatedTransactionDto {
  company_id: string  // From user login context
  branch_name?: string | null  // branch name from pos_import_lines.branch
  source_type: AggregatedTransactionSourceType  // Always 'POS'
  source_id: string  // pos_import_id from pos_import_lines
  source_ref: string  // bill_number from pos_import_lines
  transaction_date: string  // sales_date from pos_import_lines
  payment_method_id: number  // Lookup from payment_methods using code
  gross_amount: number  // subtotal from pos_import_lines
  discount_amount?: number  // discount + bill_discount from pos_import_lines
  tax_amount?: number  // tax from pos_import_lines
  service_charge_amount?: number  // service_charge from pos_import_lines
  net_amount: number  // Calculated: subtotal + tax + service_charge - (discount + bill_discount)
  currency?: string  // Default: 'IDR'
  status?: AggregatedTransactionStatus  // Default: 'READY'
}

/**
 * DTO for updating an aggregated transaction
 */
export interface UpdateAggregatedTransactionDto {
  branch_name?: string | null
  source_type?: AggregatedTransactionSourceType
  source_id?: string
  source_ref?: string
  transaction_date?: string
  payment_method_id?: number
  gross_amount?: number
  discount_amount?: number
  tax_amount?: number
  service_charge_amount?: number
  net_amount?: number
  currency?: string
  status?: AggregatedTransactionStatus
  is_reconciled?: boolean
  version?: number
}

/**
 * Query parameters for listing aggregated transactions
 */
export interface AggregatedTransactionFilterParams {
  company_id?: string
  branch_name?: string | null
  source_type?: AggregatedTransactionSourceType
  source_id?: string
  payment_method_id?: number
  transaction_date?: string
  transaction_date_from?: string
  transaction_date_to?: string
  status?: AggregatedTransactionStatus
  is_reconciled?: boolean
  has_journal?: boolean
  search?: string
  show_deleted?: boolean
}

/**
 * Sort parameters for aggregated transactions
 */
export interface AggregatedTransactionSortParams {
  field: 'transaction_date' | 'gross_amount' | 'net_amount' | 'created_at' | 'updated_at'
  order: 'asc' | 'desc'
}

/**
 * Summary statistics for aggregated transactions
 */
export interface AggregatedTransactionSummary {
  total_count: number
  total_gross_amount: number
  total_discount_amount: number
  total_tax_amount: number
  total_service_charge_amount: number
  total_net_amount: number
  by_status?: Record<AggregatedTransactionStatus, number>
  by_payment_method?: Record<number, number>
}

/**
 * Batch operation result for aggregated transactions
 */
export interface AggregatedTransactionBatchResult {
  success: string[]
  failed: Array<{ source_ref: string; error: string }>
  total_processed: number
}

/**
 * Reconciliation result for aggregated transactions
 */
export interface AggregatedTransactionReconciliationResult {
  transaction_id: string
  previous_reconciled_state: boolean
  new_reconciled_state: boolean
  reconciled_at: string
  reconciled_by: string
}

/**
 * Journal generation request for aggregated transactions
 */
export interface GenerateJournalRequestDto {
  company_id: string
  transaction_ids?: string[]
  transaction_date_from?: string
  transaction_date_to?: string
  branch_name?: string
  payment_method_id?: number
  include_unreconciled_only?: boolean
}

/**
 * Aggregated transaction row for Excel import template
 */
export interface AggregatedTransactionImportRow {
  source_type: AggregatedTransactionSourceType
  source_id: string
  source_ref: string
  transaction_date: string
  payment_method_code: string
  gross_amount: number
  discount_amount?: number
  tax_amount?: number
  service_charge_amount?: number
  net_amount: number
  currency?: string
}

