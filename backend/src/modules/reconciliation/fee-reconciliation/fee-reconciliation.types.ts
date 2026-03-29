/**
 * Fee Reconciliation Types
 * Domain types for fee reconciliation module
 */

import type { FeeConfig, FeeCalculationResult, ReconciliationResult } from './fee-calculation.service'

/**
 * Fee Reconciliation Summary - moved here from service.ts
 */
export interface FeeReconciliationSummary {
  date: Date
  totalSettlements: number
  totalGrossAmount: number
  totalExpectedNet: number
  totalActualFromBank: number
  totalMarketingFee: number
  matchedCount: number
  discrepancyCount: number
  needsReviewCount: number
  results: ReconciliationResult[]
}

/**
 * Fee configuration from payment_methods table (active only)
 */
export interface PaymentMethodFeeConfig {
  paymentMethodId: number
  paymentMethodCode: string
  paymentMethodName: string
  paymentType: string
  feePercentage: number
  feeFixedAmount: number
  feeFixedPerTransaction: boolean
}

/**
 * Aggregated POS settlement transaction
 * From pos_aggregates/aggregated_transactions
 */
export interface PosAggregate {
  id: string
  payment_method_id: number
  total_gross_amount: number
  total_transaction_count: number
  transaction_date: string // YYYY-MM-DD
  company_id: string
}

/**
 * Unreconciled bank statement deposit
 */
export interface BankDeposit {
  id: string
  bank_account_id: number
  transaction_date: string // YYYY-MM-DD
  credit_amount: number
  description: string
  payment_method_id?: number
}

// ========================================
// REQUEST/RESPONSE DTOS
// ========================================

/** Reconcile daily request */
export interface ReconcileDailyRequest {
  companyId: string
  date: string // YYYY-MM-DD
  tolerancePercentage?: number
}



/** Daily summary query */
export interface DailySummaryQuery {
  companyId: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

/**
 * Fee Discrepancy (used in bank-recon integration)
 */
export interface FeeDiscrepancyParams {
  aggregateId: string
  statementId: string
}

export interface FeeDiscrepancyMultiParams {
  aggregateId: string
  totalBankAmount: number
}

// ========================================
// REPOSITORY INTERFACE
// ========================================

export interface IFeeReconciliationRepository {
  getFeeConfigsByCompany(companyId: string): Promise<PaymentMethodFeeConfig[]>
  getFeeConfigsByPaymentMethodId(id: number): Promise<PaymentMethodFeeConfig>
  getPosAggregatesByPaymentMethodDate(
    paymentMethodId: number, 
    date: string
  ): Promise<PosAggregate | null>
  getUnreconciledDeposits(
    paymentMethodId: number, 
    date: string
  ): Promise<number>
  createReconciliationResult(result: ReconciliationResult): Promise<void>
  calculateAndSaveFeeDiscrepancy(
    aggregateId: string,
    statementId: string
  ): Promise<void>
  calculateAndSaveFeeDiscrepancyMultiMatch(
    aggregateId: string,
    totalBankAmount: number
  ): Promise<void>
  getFeeDiscrepancies(
    startDate: string,
    endDate: string,
    paymentMethodId?: number
  ): Promise<FeeDiscrepancyRecord[]>
  resetFeeDiscrepancy(aggregateId: string): Promise<void>
}

export interface FeeDiscrepancyRecord {
  aggregateId:        string
  transactionDate:    string        // YYYY-MM-DD
  paymentMethodId:    number
  paymentMethodCode:  string | null
  paymentMethodName:  string | null
  grossAmount:        number
  nettAmount:         number
  expectedFee:        number
  actualFee:          number | null
  feeDiscrepancy:     number | null
  feeDiscrepancyNote: string | null
}

// ========================================
// ENUMS
// ========================================

export enum ReconciliationStatus {
  PENDING = 'PENDING',
  RECONCILED = 'RECONCILED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVIEW = 'NEEDS_REVIEW'
}

