/**
 * Settlement Groups Types
 * Frontend types for bulk settlement reconciliation feature
 */

// ==================== ENUMS ====================

export const SettlementGroupStatus = {
  PENDING: 'PENDING',
  RECONCILED: 'RECONCILED',
  DISCREPANCY: 'DISCREPANCY',
  UNDO: 'UNDO'
} as const;

export type SettlementGroupStatusType = typeof SettlementGroupStatus[keyof typeof SettlementGroupStatus];

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
  status: SettlementGroupStatusType;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  deleted_at?: string | null; // Soft delete timestamp
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
  status: SettlementGroupStatusType;
}

/**
 * Query params untuk list settlement groups
 */
export interface SettlementGroupQueryDto {
  startDate?: string;
  endDate?: string;
  status?: SettlementGroupStatusType;
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

/**
 * Available aggregate untuk settlement
 */
export interface AvailableAggregateDto {
  id: string;
  transaction_date: string;
  gross_amount: number;
  nett_amount: number;
  payment_method_name?: string;
  branch_name?: string;
  is_reconciled: boolean;
}

// ==================== UI SPECIFIC TYPES ====================

/**
 * Wizard step configuration
 */
export interface SettlementWizardStep {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
}

/**
 * Aggregate selection for wizard
 */
export interface AggregateSelection {
  id: string;
  selected: boolean;
  allocatedAmount: number;
  originalAmount: number;
  branchName?: string;
  paymentMethod?: string;
  payment_method_name?: string;
  transaction_date?: string;
  nett_amount?: number;
}

/**
 * AI suggestion for aggregates
 */
export interface AISuggestion {
  id: string;
  aggregates: Array<{
    id: string;
    confidence: number;
    reason: string;
  }>;
  totalAmount: number;
  matchPercentage: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

/**
 * Filter options for settlement groups table
 */
export interface SettlementGroupFilters {
  startDate?: string;
  endDate?: string;
  status?: SettlementGroupStatusType;
  search?: string;
  bankAccountId?: number;
}

/**
 * Sort options for settlement groups table
 */
export interface SettlementGroupSort {
  field: 'settlement_date' | 'total_statement_amount' | 'status' | 'created_at';
  order: 'asc' | 'desc';
}

/**
 * Table column configuration
 */
export interface SettlementGroupColumn {
  key: string;
  label: string;
  sortable: boolean;
  width?: string;
}

// ==================== API REQUEST/RESPONSE TYPES ====================

/**
 * Request for creating settlement group
 */
export interface CreateSettlementGroupRequest {
  bankStatementId: string;
  aggregateIds: string[];
  notes?: string;
  overrideDifference?: boolean;
}

/**
 * Response for settlement group list with pagination
 */
export interface SettlementGroupListResponse {
  data: SettlementGroup[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Request for available aggregates
 */
export interface GetAvailableAggregatesRequest {
  startDate?: string;
  endDate?: string;
  bankAccountId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Response for available aggregates
 */
export interface AvailableAggregatesResponse {
  data: AvailableAggregateDto[];
  total: number;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * Request for AI suggestions
 */
export interface GetSuggestionsRequest {
  targetAmount: number;
  tolerancePercent?: number;
  dateToleranceDays?: number;
  maxResults?: number;
}

/**
 * Available bank statement for settlement selection
 */
export interface AvailableBankStatementDto {
  id: string;
  transaction_date: string;
  description: string;
  reference_number?: string;
  debit_amount: number;
  credit_amount: number;
  amount: number; // Calculated: credit - debit
  is_reconciled: boolean;
  bank_name?: string;
  source_file: string;
  bank_account?: {
    account_name?: string;
    account_number?: string;
  };
}

/**
 * Query params for available bank statements
 */
export interface GetAvailableBankStatementsRequest {
  bankAccountId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Response for available bank statements
 */
export interface AvailableBankStatementsResponse {
  data: AvailableBankStatementDto[];
  total: number;
}

// ==================== STATUS AND COLOR MAPPINGS ====================

/**
 * Status color mapping for badges
 */
export const SettlementGroupStatusColors = {
  [SettlementGroupStatus.PENDING]: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-200',
  },
  [SettlementGroupStatus.RECONCILED]: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
  },
  [SettlementGroupStatus.DISCREPANCY]: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-200',
  },
  [SettlementGroupStatus.UNDO]: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
  },
} as const;

/**
 * Status labels for display
 */
export const SettlementGroupStatusLabels = {
  [SettlementGroupStatus.PENDING]: 'Pending',
  [SettlementGroupStatus.RECONCILED]: 'Reconciled',
  [SettlementGroupStatus.DISCREPANCY]: 'Discrepancy',
  [SettlementGroupStatus.UNDO]: 'Undone',
} as const;


