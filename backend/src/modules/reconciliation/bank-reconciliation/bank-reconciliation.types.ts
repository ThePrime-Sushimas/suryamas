/**
 * Bank Reconciliation Module Types
 */

// ==================== ENUMS ====================

export enum BankReconciliationStatus {
  PENDING = 'PENDING',
  AUTO_MATCHED = 'AUTO_MATCHED',
  MANUALLY_MATCHED = 'MANUALLY_MATCHED',
  DISCREPANCY = 'DISCREPANCY',
  UNRECONCILED = 'UNRECONCILED'
}

// ==================== CORE INTERFACES ====================

/**
 * Configuration for matching logic
 */
export interface MatchingCriteria {
  amountTolerance: number; // e.g., 0.01 for rounding
  dateBufferDays: number; // e.g., 1-3 days
  differenceThreshold: number; // absolute amount that triggers override requirement
}

/**
 * Result of a single match attempt
 */
export interface ReconciliationMatch {
  aggregateId: string;
  statementId: string;
  matchScore: number; // 0-100
  matchCriteria: 'EXACT_REF' | 'EXACT_AMOUNT_DATE' | 'FUZZY_AMOUNT_DATE' | 'AMOUNT_ONLY';
  difference: number;
  notes?: string;
}

// ==================== DTOs ====================

/**
 * Request for manual reconciliation
 */
export interface ManualReconcileRequestDto {
  companyId: string;
  aggregateId: string;
  statementId: string;
  notes?: string;
  overrideDifference?: boolean;
}

/**
 * Request for automatic matching process
 */
export interface AutoMatchRequestDto {
  companyId: string;
  startDate: string; // ISO Date
  endDate: string; // ISO Date
  matchingCriteria?: Partial<MatchingCriteria>;
}

/**
 * Summary of a reconciliation period
 */
export interface ReconciliationSummaryDto {
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

// ==================== EXTENDED MODELS ====================

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
  reconciliation_id?: string;
matched_aggregate?: {
    id: string;
    gross_amount: number;
    nett_amount: number;
    bill_after_discount: number;
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
  reason: 'NO_MATCH' | 'AMOUNT_MISMATCH' | 'DATE_ANOMALY';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

// =====================================================
// MULTI-MATCH FEATURE TYPES
// =====================================================

/**
 * Status untuk multi-match groups
 */
export enum ReconciliationGroupStatus {
  PENDING = 'PENDING',
  RECONCILED = 'RECONCILED',
  DISCREPANCY = 'DISCREPANCY',
  UNDO = 'UNDO'
}

/**
 * Reconciliation group for multi-match (1 POS = N Bank Statements)
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
  aggregate?: AggregatedTransactionInfo;
  details?: ReconciliationGroupDetail[];
}

/**
 * Detail dari group - menyimpan relasi antara statement dan group
 */
export interface ReconciliationGroupDetail {
  id: string;
  group_id: string;
  statement_id: string;
  amount: number;
  created_at: string;
  statement?: BankStatementInfo;
}

/**
 * Info singkat aggregate untuk response
 */
export interface AggregatedTransactionInfo {
  id: string;
  transaction_date: string;
  gross_amount: number;
  nett_amount: number;
  payment_method_name: string;
  merchant_name?: string;
}

/**
 * Info singkat bank statement untuk response
 */
export interface BankStatementInfo {
  id: string;
  transaction_date: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  amount?: number; // Calculated: credit - debit
}

/**
 * Request untuk create multi-match
 */
export interface MultiMatchRequestDto {
  companyId: string;
  aggregateId: string;
  statementIds: string[];
  notes?: string;
  overrideDifference?: boolean;
}

/**
 * Result dari create multi-match
 */
export interface MultiMatchResultDto {
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
 * Suggestion untuk multi-match
 */
export interface MultiMatchSuggestion {
  statements: BankStatementInfo[];
  totalAmount: number;
  matchPercentage: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}
