/**
 * Bank Reconciliation Statuses
 */
export enum BankReconciliationStatus {
  PENDING = "PENDING",
  AUTO_MATCHED = "AUTO_MATCHED",
  MANUALLY_MATCHED = "MANUALLY_MATCHED",
  DISCREPANCY = "DISCREPANCY",
  UNRECONCILED = "UNRECONCILED",
}

/**
 * Match Criteria types
 */
export type MatchCriteriaType =
  | "EXACT_REF"
  | "EXACT_AMOUNT_DATE"
  | "FUZZY_AMOUNT_DATE"
  | "AMOUNT_ONLY";

/**
 * Configuration for matching logic
 */
export interface MatchingCriteria {
  amountTolerance: number;
  dateBufferDays: number;
  differenceThreshold: number;
}

/**
 * Summary of a reconciliation period
 */
export interface ReconciliationSummary {
  period: {
    startDate: string;
    endDate: string;
  };
  totalAggregates: number;
  totalStatements: number;
  autoMatched: number;
  manuallyMatched: number;
  discrepancies: number;
  unreconciled: number;
  totalDifference: number;
  percentageReconciled: number;
}

/**
 * Bank statement with matched aggregate info
 */
export interface BankStatementWithMatch {
  id: string;
  transaction_date: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  is_reconciled: boolean;
  status: BankReconciliationStatus;
  reconciliation_id?: string;
  matched_aggregate?: {
    id: string;
    gross_amount: number;
    nett_amount: number;
    payment_type: string;
  };
}

/**
 * Discrepancy report item
 */
export interface DiscrepancyItem {
  statementId: string;
  aggregateId?: string;
  difference: number;
  reason: "NO_MATCH" | "AMOUNT_MISMATCH" | "DATE_ANOMALY";
  severity: "HIGH" | "MEDIUM" | "LOW";
  statement?: BankStatementWithMatch;
}

/**
 * DTOs for API requests
 */
export interface ManualReconcileRequest {
  companyId: string;
  aggregateId: string;
  statementId: string;
  notes?: string;
  overrideDifference?: boolean;
}

export interface AutoMatchRequest {
  companyId: string;
  startDate: string;
  endDate: string;
  matchingCriteria?: Partial<MatchingCriteria>;
}

export interface GetSummaryParams {
  companyId: string;
  startDate: string;
  endDate: string;
}

export interface GetDiscrepanciesParams {
  companyId: string;
  startDate: string;
  endDate: string;
  threshold?: number;
}
