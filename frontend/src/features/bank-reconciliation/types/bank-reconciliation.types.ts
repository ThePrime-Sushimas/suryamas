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
  aggregateId: string;
  statementId: string;
  notes?: string;
  overrideDifference?: boolean;
}

export interface AutoMatchRequest {
  startDate: string;
  endDate: string;
  bankAccountId?: number;
  matchingCriteria?: Partial<MatchingCriteria>;
}

export interface GetSummaryParams {
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

// =====================================================
// MULTI-MATCH TYPES
// =====================================================

/**
 * Status untuk reconciliation group
 */
export type ReconciliationGroupStatus = 
  | 'PENDING' 
  | 'RECONCILED' 
  | 'DISCREPANCY' 
  | 'UNDO';

export const ReconciliationGroupStatusMap = {
  PENDING: 'PENDING',
  RECONCILED: 'RECONCILED',
  DISCREPANCY: 'DISCREPANCY',
  UNDO: 'UNDO',
} as const;

/**
 * Reconciliation group untuk multi-match
 */
export interface ReconciliationGroup {
  id: string;
  company_id: string;
  aggregate_id: string;
  total_bank_amount: number;
  aggregate_amount: number;
  difference: number;
  status: ReconciliationGroupStatus;
  notes?: string;
  reconciled_by?: string;
  reconciled_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // Joined data
  aggregate?: {
    id: string;
    transaction_date: string;
    gross_amount: number;
    nett_amount: number;
    payment_method_name: string;
  };
  details?: Array<{
    id: string;
    statement_id: string;
    amount: number;
    statement?: {
      id: string;
      transaction_date: string;
      description: string;
      debit_amount: number;
      credit_amount: number;
    };
  }>;
}

/**
 * Suggestion untuk multi-match
 */
export interface MultiMatchSuggestion {
  statements: Array<{
    id: string;
    transaction_date: string;
    description: string;
    debit_amount: number;
    credit_amount: number;
    amount: number;
  }>;
  totalAmount: number;
  matchPercentage: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

/**
 * Request untuk create multi-match
 */
export interface MultiMatchRequest {
  aggregateId: string;
  statementIds: string[];
  notes?: string;
  overrideDifference?: boolean;
}

/**
 * Result dari create multi-match
 */
export interface MultiMatchResult {
  success: boolean;
  groupId: string;
  aggregateId: string;
  statementIds: string[];
  totalBankAmount: number;
  aggregateAmount: number;
  difference: number;
  differencePercent: number;
}

/**
 * Extended BankStatement dengan amount calculated field
 */
export interface BankStatementWithAmount extends BankStatementWithMatch {
  amount: number;
}
