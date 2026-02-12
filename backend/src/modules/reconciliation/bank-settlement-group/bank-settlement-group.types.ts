/**
 * Settlement Group Module Types
 * Bulk Settlement Reconciliation (Many Aggregates → 1 Bank Statement)
 */

// ==================== ENUMS ====================

export enum SettlementGroupStatus {
  PENDING = 'PENDING',
  RECONCILED = 'RECONCILED',
  DISCREPANCY = 'DISCREPANCY',
  UNDO = 'UNDO'
}

// ==================== CORE INTERFACES ====================

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
  bank_name?: string;
  payment_method?: string;
}

// ==================== DTOs ====================

/**
 * Request untuk create settlement group (BULK SETTLEMENT)
 */
export interface CreateSettlementGroupDto {
  companyId: string;
  bankStatementId: string;
  aggregateIds: string[];
  notes?: string;
  overrideDifference?: boolean;
  userId?: string;
}

/**
 * Result dari create settlement group
 */
export interface CreateSettlementGroupResultDto {
  success: boolean;
  groupId: string;
  settlementNumber: string;
  bankStatementId: string;
  statementAmount: number;
  totalAllocatedAmount: number;
  difference: number;
  differencePercent: number;
  aggregateCount: number;
  status: SettlementGroupStatus;
}

/**
 * Request untuk undo settlement group
 */
export interface UndoSettlementGroupDto {
  groupId: string;
  userId?: string;
  companyId?: string;
}

// ==================== QUERY TYPES ====================

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

/**
 * Available aggregate untuk settlement
 */
export interface AvailableAggregateDto {
  id: string;
  transaction_date: string;
  gross_amount: number;
  nett_amount: number;
  payment_method_name?: string;
  is_reconciled: boolean;
}

