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
  branch_name?: string;
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

export interface AutoMatchPreviewRequest {
  startDate: string;
  endDate: string;
  bankAccountId?: number;
  matchingCriteria?: Partial<MatchingCriteria>;
}

export interface AutoMatchConfirmRequest {
  statementIds: string[];
  matchingCriteria?: Partial<MatchingCriteria>;
}

export interface AutoMatchPreviewMatch {
  statementId: string;
  statement: {
    id: string;
    transaction_date: string;
    description: string;
    reference_number?: string;
    debit_amount: number;
    credit_amount: number;
    amount: number;
  };
  aggregate: {
    id: string;
    transaction_date: string;
    nett_amount: number;
    reference_number?: string;
    payment_method_name?: string;
    gross_amount: number;
  };
  matchScore: number;
  matchCriteria: MatchCriteriaType;
  difference: number;
}

export interface AutoMatchPreviewResponse {
  matches: AutoMatchPreviewMatch[];
  summary: {
    totalStatements: number;
    matchedStatements: number;
    unmatchedStatements: number;
  };
  unmatchedStatements: Array<{
    id: string;
    transaction_date: string;
    description: string;
    reference_number?: string;
    debit_amount: number;
    credit_amount: number;
    amount: number;
  }>;
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

// =====================================================
// SETTLEMENT GROUPS TYPES (1 Bank Statement → Many Aggregates)
// =====================================================

/**
 * Status untuk settlement group (BULK SETTLEMENT)
 */
export type SettlementGroupStatus = 
  | 'PENDING'
  | 'RECONCILED'
  | 'DISCREPANCY'
  | 'UNDO';

export const SettlementGroupStatusMap = {
  PENDING: 'PENDING',
  RECONCILED: 'RECONCILED',
  DISCREPANCY: 'DISCREPANCY',
  UNDO: 'UNDO',
} as const;

/**
 * Settlement Group - 1 Bank Statement → Many Aggregates
 */
export interface SettlementGroup {
  id: string;
  company_id: string;
  bank_statement_id: string;
  settlement_number: string;
  settlement_date: string;
  payment_method?: string;
  bank_name?: string;
  total_statement_amount: number;
  total_allocated_amount: number;
  difference: number;
  status: SettlementGroupStatus;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  deleted_at?: string | null;
  
  // Joined data
  aggregates?: SettlementAggregate[];
  bank_statement?: BankStatementInfo;
}

/**
 * Settlement Aggregate - mapping aggregate ke settlement group
 */
export interface SettlementAggregate {
  id: string;
  settlement_group_id: string;
  aggregate_id: string;
  branch_name?: string;
  allocated_amount: number;
  original_amount: number;
  created_at: string;
  aggregate?: AggregatedTransactionInfo;
}

/**
 * Info singkat aggregate untuk response
 */
export interface AggregatedTransactionInfo {
  id: string;
  transaction_date: string;
  gross_amount: number;
  nett_amount: number;
  payment_method_name?: string;
  branch_name?: string;
}

/**
 * Info singkat bank statement untuk response
 */
export interface BankStatementInfo {
  id: string;
  transaction_date: string;
  description: string;
  reference_number?: string;
  debit_amount: number;
  credit_amount: number;
  amount?: number;
  bank_name?: string;
  payment_method?: string;
}

/**
 * Query params untuk list settlement groups
 */
export interface SettlementGroupQueryDto {
  startDate?: string;
  endDate?: string;
  status?: SettlementGroupStatus;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

/**
 * Response paginated untuk list settlement groups
 */
export interface SettlementGroupListResponseDto {
  data: SettlementGroup[];
  total: number;
  page: number;
  limit: number;
}
