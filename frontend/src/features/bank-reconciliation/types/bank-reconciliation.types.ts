/**
 * Bank Reconciliation Statuses
 */
/**
 * Bank Reconciliation Statuses
 */
export type BankReconciliationStatus =
  | "PENDING"
  | "AUTO_MATCHED"
  | "MANUALLY_MATCHED"
  | "DISCREPANCY"
  | "UNRECONCILED";

export const BankReconciliationStatusMap = {
  PENDING: "PENDING",
  AUTO_MATCHED: "AUTO_MATCHED",
  MANUALLY_MATCHED: "MANUALLY_MATCHED",
  DISCREPANCY: "DISCREPANCY",
  UNRECONCILED: "UNRECONCILED",
} as const;

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

export interface PotentialMatch {
  id: string;
  gross_amount: number;
  nett_amount: number;
  payment_type: string;
  payment_method_name: string;
}

/**
 * Bank statement with matched aggregate info
 */
export interface BankStatementWithMatch {
  id: string;
  transaction_date: string;
  description: string;
  reference_number?: string;
  debit_amount: number;
  credit_amount: number;
  is_reconciled: boolean;
  status: BankReconciliationStatus;
  potentialMatches?: PotentialMatch[];
  reconciliation_id?: string;
  matched_aggregate?: {
    id: string;
    gross_amount: number;
    nett_amount: number;
    payment_type: string;
    payment_method_name?: string;
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
  bankAccountId?: number;
  matchingCriteria?: Partial<MatchingCriteria>;
}

export interface GetSummaryParams {
  companyId: string;
  startDate: string;
  endDate: string;
}

export interface GetStatementsParams extends GetSummaryParams {
  bankAccountId?: number;
  threshold?: number;
}

export interface BankAccountStatus {
  id: number;
  account_name: string;
  account_number: string;
  banks: {
    bank_name: string;
    bank_code: string;
  };
  stats: {
    total: number;
    unreconciled: number;
  };
}
