export interface AggregatedTransaction {
  id: string;
  branch_name?: string;
  source_type: string;
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
  journal_id?: string;
  is_reconciled: boolean;
  status: 'READY' | 'FAILED' | 'RECONCILED' | 'PENDING' | 'DISCREPANCY';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  version: number;
}

export interface ReconciliationAggregate {
  id: string;
  nett_amount: number;
  transaction_date: string;
  reference_number?: string;
  payment_method_id: number;
  payment_method_name?: string;
  gross_amount: number;
  percentage_fee_amount: number;
  fixed_fee_amount: number;
  total_fee_amount: number;
  bill_after_discount: number;
  transaction_count: number;
  reconciliation_status: string;
  confidence_score?: number;
  amount_difference?: number;
  date_difference_days?: number;
}

export interface IReconciliationOrchestratorService {
  getAggregatesForDate(date: Date): Promise<ReconciliationAggregate[]>;
  getAggregatesByDateRange(startDate: Date, endDate: Date): Promise<ReconciliationAggregate[]>;
  getAggregate(id: string): Promise<AggregatedTransaction>;
  updateReconciliationStatus(
    aggregateId: string, 
    status: 'PENDING' | 'RECONCILED' | 'DISCREPANCY',
    statementId?: string,
    reconciledBy?: string
  ): Promise<void>;
  getReconciliationSummary(startDate: Date, endDate: Date): Promise<any>;
  findPotentialAggregatesForStatement(
    statementAmount: number,
    statementDate: Date,
    tolerance?: number,
    dateBufferDays?: number
  ): Promise<ReconciliationAggregate[]>;
  bulkUpdateReconciliationStatus(
    updates: Array<{
      aggregateId: string;
      status: 'PENDING' | 'RECONCILED' | 'DISCREPANCY';
      statementId?: string;
    }>
  ): Promise<void>;
}

