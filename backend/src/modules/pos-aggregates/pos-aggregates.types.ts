// backend/src/modules/pos-aggregates/pos-aggregates.types.ts

/**
 * Lifecycle status of aggregated transaction.
 */
export type AggregatedTransactionStatus =
  | 'READY'
  | 'JOURNALIZED'
  | 'POSTED'
  | 'ERROR'
  | 'SPLIT'
  | 'REFUNDED'
  | 'VOIDED'
  | 'RECONCILED'
  | 'DELETED'

/**
 * Source system that produces aggregated transactions.
 */
export type AggregatedTransactionSourceType = 'POS'

/**
 * Core aggregated transaction entity.
 * Mirrors public.aggregated_transactions table.
 */
export interface AggregatedTransaction {
  id: string

  company_id: string
  branch_id?: string | null

  source_type: AggregatedTransactionSourceType
  source_id: string
  source_ref: string

  transaction_date: string // YYYY-MM-DD
  payment_method_id: number

  gross_amount: number
  discount_amount: number
  tax_amount: number
  service_charge_amount: number
  net_amount: number

  currency: string

  journal_id?: string | null
  status: AggregatedTransactionStatus
  error_message?: string | null
  version: number

  // === Audit & versioning ===
  created_at: string
  created_by?: string | null
  updated_at?: string | null
  updated_by?: string | null
  deleted_at?: string | null
  deleted_by?: string | null

  // === Split / Refund ===
  parent_id?: string | null
  split_sequence?: number | null
  split_total?: number | null
  original_net_amount?: number | null
  split_count?: number | null
  split_total_amount?: number | null

  refund_type?: 'FULL' | 'PARTIAL' | null
  refund_reason?: string | null
  refund_approved_by?: string | null
  refund_approved_at?: string | null

  // === Void ===
  void_reason?: string | null
  voided_by?: string | null
  voided_at?: string | null

  // === Reconciliation ===
  is_reconciled?: boolean
}

/**
 * Payload used internally to create aggregated transaction.
 * Excludes DB-managed fields, but includes audit + split/refund info.
 */
export interface CreateAggregatedTransactionInput {
  company_id: string
  branch_id?: string | null

  source_type: AggregatedTransactionSourceType
  source_id: string
  source_ref: string

  transaction_date: string
  payment_method_id: number

  gross_amount: number
  discount_amount?: number
  tax_amount?: number
  service_charge_amount?: number
  net_amount: number
  currency?: string
  version: number

  // === Audit ===
  created_by?: string | null
  updated_at?: string | null
  updated_by?: string | null
  deleted_at?: string | null
  deleted_by?: string | null

  // === Split / Refund ===
  parent_id?: string | null
  split_sequence?: number | null
  split_total?: number | null
  original_net_amount?: number | null

  refund_type?: 'FULL' | 'PARTIAL' | null
  refund_reason?: string | null
  refund_approved_by?: string | null
  refund_approved_at?: string | null

  // === Void ===
  void_reason?: string | null
  voided_by?: string | null
  voided_at?: string | null
}

/**
 * Partial update payload for status transitions.
 */
export interface UpdateAggregatedTransactionStatusInput {
  status: AggregatedTransactionStatus
  journal_id?: string | null
  error_message?: string | null

  // Optional: Split/Refund/Void updates
  split_count?: number | null
  split_total_amount?: number | null
  void_reason?: string | null
  voided_by?: string | null
  voided_at?: string | null
  refund_reason?: string | null
  refund_approved_by?: string | null
  refund_approved_at?: string | null
  is_reconciled?: boolean
}
