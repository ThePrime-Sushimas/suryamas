// Reconciliation Module Types
export interface SettlementReport {
  id: string;
  company_id: string;
  platform_code: string;
  branch_id?: string;
  transaction_date: Date;
  report_date: Date;
  release_date: Date;
  gross_amount: number;
  commission_amount: number;
  ads_amount: number;
  other_fees_amount: number;
  nett_amount: number;
  original_filename?: string;
  file_hash?: string;
  imported_at: Date;
  imported_by: string;
  bank_recon_status: ReconciliationStatus;
  fee_recon_status: ReconciliationStatus;
  overall_status: ReconciliationStatus;
  bank_matched_at?: Date;
  fee_reconciled_at?: Date;
  completed_at?: Date;
}

export interface BankStatement {
  id: string;
  bank_account_id: string;
  statement_date: Date;
  transaction_date: Date;
  description: string;
  reference_number?: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  settlement_id?: string;
  reconciliation_status: ReconciliationStatus;
  matched_at?: Date;
  matched_by?: string;
  source_type: BankStatementSource;
  source_reference?: string;
  imported_at: Date;
}

export interface FeeMaster {
  id: string;
  company_id: string;
  platform_code: string;
  branch_id?: string;
  fee_type: FeeType;
  fee_name: string;
  calculation_method: CalculationMethod;
  calculation_value: number;
  apply_to: ApplyTo;
  min_amount?: number;
  max_amount?: number;
  expense_account_id: string;
  is_auto_apply: boolean;
  effective_date: Date;
  expiry_date?: Date;
  is_active: boolean;
}

export interface AppliedFee {
  id: string;
  settlement_id: string;
  fee_master_id: string;
  expected_amount: number;
  actual_amount?: number;
  difference_amount: number;
  reconciliation_status: ReconciliationStatus;
  auto_approved: boolean;
  needs_review: boolean;
  adjusted_amount?: number;
  adjustment_reason?: string;
  adjusted_by?: string;
  adjusted_at?: Date;
  journal_line_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReconciliationRun {
  id: string;
  company_id: string;
  run_type: RunType;
  run_date: Date;
  initiated_by: string;
  platform_codes?: string[];
  branch_ids?: string[];
  total_items: number;
  processed_items: number;
  failed_items: number;
  current_step: string;
  status: RunStatus;
  result_summary?: any;
  error_log?: string;
  started_at: Date;
  completed_at?: Date;
}

// Enums
export type ReconciliationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'MATCHED'
  | 'DISCREPANCY'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'FAILED';

export type BankStatementSource =
  | 'MANUAL'
  | 'API'
  | 'EMAIL'
  | 'AUTO_IMPORT';

export type FeeType =
  | 'COMMISSION'
  | 'ADS'
  | 'MDR'
  | 'PROMO'
  | 'OTHER';

export type CalculationMethod =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'TIERED';

export type ApplyTo =
  | 'GROSS'
  | 'NETT'
  | 'AFTER_TAX';

export type RunType =
  | 'DAILY'
  | 'ADHOC'
  | 'MONTHLY'
  | 'QUARTERLY';

export type RunStatus =
  | 'INITIALIZED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// Service Interfaces
export interface MatchingRule {
  name: string;
  priority: number;
  matcher: (settlement: SettlementReport, statement: BankStatement) => boolean;
  autoApprove?: boolean;
  confidence?: number;
}

export interface MatchResult {
  settlementId: string;
  statementId?: string;
  rule: string;
  confidence: number;
  autoApprove: boolean;
}

export interface BankReconResult {
  totalSettlements: number;
  matchedCount: number;
  unmatchedCount: number;
  discrepancies: any[];
  matches: MatchResult[];
  unmatchedSettlements: SettlementReport[];
}

export interface FeeReconResult {
  totalSettlements: number;
  matchedCount: number;
  discrepancyCount: number;
  needsReviewCount: number;
  results: SettlementFeeRecon[];
}

export interface SettlementFeeRecon {
  settlementId: string;
  expectedFees: FeeCalculation;
  actualFees: FeeCalculation;
  differences: FeeDifferences;
  needsReview: boolean;
  autoApproved: boolean;
  appliedFees: AppliedFee[];
}

export interface FeeCalculation {
  commission: number;
  ads: number;
  other: number;
  total: number;
}

export interface FeeDifferences {
  commissionDiff: number;
  adsDiff: number;
  totalDiff: number;
}

// Workflow Types
export interface ReconciliationWorkflow {
  states: Record<string, WorkflowState>;
  steps: WorkflowStep[];
}

export interface WorkflowState {
  transitions: string[];
  final?: boolean;
}

export interface WorkflowStep {
  name: string;
  service: string;
  input: string[];
  output: string;
  autoTransition: boolean;
  conditions?: string[];
  manual?: boolean;
}

// API Request/Response Types
export interface BankStatementUploadRequest {
  bankAccountId: string;
  file: Express.Multer.File;
  config: BankStatementConfig;
}

export interface BankStatementConfig {
  dateColumn: string;
  descriptionColumn: string;
  debitColumn: string;
  creditColumn: string;
  balanceColumn?: string;
  referenceColumn?: string;
  startRow: number;
  dateFormat: string;
  hasHeader: boolean;
}

export interface SettlementUploadRequest {
  files: Express.Multer.File[];
  platform: string;
  branchId?: string;
  transactionDate: Date;
}

export interface ManualMatchRequest {
  settlementId: string;
  statementId: string;
  notes?: string;
}

export interface FeeAdjustmentRequest {
  appliedFeeId: string;
  adjustedAmount: number;
  reason: string;
}

export interface ReviewActionRequest {
  reviewId: string;
  action: 'APPROVE' | 'REJECT';
  notes?: string;
}

// Repository Interfaces
export interface SettlementRepository {
  getPendingSettlements(date: Date, companyId: string): Promise<SettlementReport[]>;
  getBankMatchedSettlements(date: Date, companyId: string): Promise<SettlementReport[]>;
  updateReconciliationStatus(id: string, status: ReconciliationStatus): Promise<void>;
  create(settlement: Omit<SettlementReport, 'id'>): Promise<SettlementReport>;
  findById(id: string): Promise<SettlementReport | null>;
}

export interface BankStatementRepository {
  getUnreconciledStatements(date: Date, companyId: string): Promise<BankStatement[]>;
  create(statement: Omit<BankStatement, 'id'>): Promise<BankStatement>;
  updateReconciliationStatus(id: string, status: ReconciliationStatus, settlementId?: string): Promise<void>;
  findById(id: string): Promise<BankStatement | null>;
}

export interface FeeRepository {
  getActiveFeeMasters(platformCode: string, branchId?: string, date?: Date): Promise<FeeMaster[]>;
  createAppliedFee(fee: Omit<AppliedFee, 'id'>): Promise<AppliedFee>;
  updateAppliedFee(id: string, updates: Partial<AppliedFee>): Promise<void>;
  getAppliedFeesBySettlement(settlementId: string): Promise<AppliedFee[]>;
}

export interface ReconciliationRunRepository {
  create(run: Omit<ReconciliationRun, 'id'>): Promise<ReconciliationRun>;
  updateProgress(id: string, processed: number, failed: number): Promise<void>;
  updateStatus(id: string, status: RunStatus, result?: any): Promise<void>;
  findById(id: string): Promise<ReconciliationRun | null>;
}
