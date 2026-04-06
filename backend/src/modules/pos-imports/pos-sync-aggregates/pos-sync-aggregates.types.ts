export interface PosSyncAggregate {
  id: string;
  sales_date: string;
  branch_pos_id: number;
  branch_id: string | null;
  branch_name: string | null;
  payment_pos_id: number;
  payment_method_id: number | null;
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  other_tax_amount: number;
  grand_total: number;
  payment_amount: number;
  transaction_count: number;
  fee_percentage: number;
  fee_fixed_amount: number;
  percentage_fee_amount: number;
  fixed_fee_amount_calc: number;
  total_fee_amount: number;
  nett_amount: number;
  status: "PENDING" | "READY" | "FAILED" | "JOURNALED";
  skip_reason: string | null;
  journal_id: string | null;
  recalculated: boolean;
  recalculated_count: number;
  recalculated_at: string | null;
  // Reconciliation fields
  is_reconciled: boolean;
  bank_statement_id: number | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  actual_fee_amount: number | null;
  fee_discrepancy: number | null;
  fee_discrepancy_note: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface PosSyncAggregateLine {
  id: string;
  aggregate_id: string;
  sales_num: string;
  sales_date: string;
  branch_pos_id: number;
  subtotal: number;
  discount_total: number;
  other_tax_total: number;
  vat_total: number;
  grand_total: number;
  payment_pos_id: number;
  payment_amount: number;
  created_at: string;
}

export interface ListAggregatesParams {
  date_from?: string;
  date_to?: string;
  branch_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ReconcilePosSyncAggregateDto {
  statementId: number;
  notes?: string;
}
