/**
 * Fee Reconciliation Service (Refactored)
 * Pure orchestration layer - no direct DB access
 * Dependencies injected, uses repository pattern
 * 
 * Flow:
 * 1. repo.getFeeConfigsByCompany()
 * 2. feeCalculationService.calculateExpectedNet()
 * 3. repo.getUnreconciledDeposits()
 * 4. repo.calculateAndSaveFeeDiscrepancy() if needed
 * 
 * @see repo.ts for DB operations
 */

import { feeCalculationService, ReconciliationResult } from './fee-calculation.service'
import { feeReconciliationRepository } from './fee-reconciliation.repository'
import type { IFeeReconciliationRepository, FeeReconciliationSummary, FeeDiscrepancyRecord } from './fee-reconciliation.types'
import { getFeeReconciliationConfig, type FeeReconciliationConfig } from './fee-reconciliation.config'
import { 
  NoAggregatedTransactionsError,
} from './fee-reconciliation.errors'
import { logInfo, logWarn, logError } from '../../../config/logger'

export class FeeReconciliationService {
  private config: FeeReconciliationConfig

  constructor(
    private readonly repo: IFeeReconciliationRepository = feeReconciliationRepository,
  ) {
    this.config = getFeeReconciliationConfig()
  }

  /**
   * Reconcile one payment method for specific date
   */
  async reconcilePaymentMethod(
    paymentMethodId: number,
    date: Date,
    tolerancePercentage = this.config.defaultTolerancePercentage
  ): Promise<ReconciliationResult> {
    logInfo('Reconciling payment method', { paymentMethodId, date: date.toISOString().split('T')[0] })

    // 1. Get fee config from repo
    const feeConfig = await this.repo.getFeeConfigsByPaymentMethodId(paymentMethodId)

    // 2. Get POS aggregates from repo
    const dateStr = date.toISOString().split('T')[0]
    const aggregate = await this.repo.getPosAggregatesByPaymentMethodDate(paymentMethodId, dateStr)
    
    if (!aggregate) {
      throw new NoAggregatedTransactionsError(paymentMethodId, dateStr)
    }

    const { total_gross_amount: grossAmount, total_transaction_count: txCount } = aggregate

    if (grossAmount <= 0) {
      throw new Error('Gross amount must be positive')
    }

    // 3. Calculate expected net using feeCalculationService
    const expectedResult = feeCalculationService.calculateExpectedNet(
      grossAmount,
      txCount,
      {
        fee_percentage: feeConfig.feePercentage,
        fee_fixed_amount: feeConfig.feeFixedAmount,
        fee_fixed_per_transaction: feeConfig.feeFixedPerTransaction,
      }
    )

    // 4. Get unreconciled bank deposits from repo
    const actualFromBank = await this.repo.getUnreconciledDeposits(paymentMethodId, dateStr)

    // 5. Calculate marketing fee discrepancy
    const tolerance = expectedResult.expectedNet * (tolerancePercentage / 100)
    const difference = expectedResult.expectedNet - actualFromBank
    const isWithinTolerance = Math.abs(difference) <= tolerance
    const needsReview = !isWithinTolerance || Math.abs(difference) > this.config.reviewThreshold

    const result: ReconciliationResult = {
      paymentMethodId: feeConfig.paymentMethodId,
      paymentMethodCode: feeConfig.paymentMethodCode,
      paymentMethodName: feeConfig.paymentMethodName,
      date,
      totalGross: expectedResult.grossAmount,
      transactionCount: expectedResult.transactionCount,
      percentageFee: expectedResult.percentageFee,
      fixedFee: expectedResult.fixedFee,
      totalFee: expectedResult.totalFee,
      expectedNet: expectedResult.expectedNet,
      actualFromBank,
      difference,
      marketingFee: difference > 0 ? difference : 0,
      isWithinTolerance,
      needsReview,
    }

    if (needsReview && Math.abs(difference) > this.config.reviewThreshold) {
      logWarn('Reconciliation needs manual review', { 
        paymentMethodId, 
        dateStr, 
        difference, 
        tolerance 
      })
    }

    // Optional: save result for audit
    await this.repo.createReconciliationResult(result)

    return result
  }

  /**
   * Reconcile all payment methods for a company on specific date
   */
  async reconcileDaily(
    companyId: string,
    date: Date,
    tolerancePercentage = this.config.defaultTolerancePercentage
  ): Promise<FeeReconciliationSummary> {
    logInfo('Daily reconciliation', { companyId, date: date.toISOString().split('T')[0] })

    // 1. Get all fee configs
    const feeConfigs = await this.repo.getFeeConfigsByCompany(companyId)

    if (feeConfigs.length === 0) {
      logWarn('No active payment methods with fee configs', { companyId })
    }

    // 2. Process each in parallel batches
    const dateStr = date.toISOString().split('T')[0]
    const results: ReconciliationResult[] = []
    let stats = {
      totalGross: 0,
      totalExpectedNet: 0,
      totalActualBank: 0,
      totalMarketingFee: 0,
      matched: 0,
      discrepancy: 0,
      needsReview: 0,
      failed: 0
    }

    const batchSize = this.config.batchSize

    for (let i = 0; i < feeConfigs.length; i += batchSize) {
      const batch = feeConfigs.slice(i, i + batchSize)
      const batchPromises = batch.map(async (config) => {
        try {
          const result = await this.reconcilePaymentMethod(
            config.paymentMethodId,
            date,
            tolerancePercentage
          )
          return result
        } catch (error) {
          logError('Payment method reconciliation failed', {
            paymentMethodId: config.paymentMethodId,
            error: (error as Error).message
          })
          stats.failed++
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.filter(Boolean) as ReconciliationResult[])

      logInfo(`Processed batch ${Math.floor(i/batchSize)+1}/${Math.ceil(feeConfigs.length/batchSize)}`, { 
        batchSize: batch.length,
        success: batchResults.filter(Boolean).length,
        failed: batchResults.filter(r => !r).length 
      })
    }

    // 3. Calculate summary
    results.forEach(result => {
      stats.totalGross += result.totalGross
      stats.totalExpectedNet += result.expectedNet
      stats.totalActualBank += result.actualFromBank
      stats.totalMarketingFee += result.marketingFee

      if (result.isWithinTolerance) {
        stats.matched++
      } else {
        stats.discrepancy++
      }

      if (result.needsReview) {
        stats.needsReview++
      }
    })

    const summary: FeeReconciliationSummary = {
      date,
      totalSettlements: results.length,
      totalGrossAmount: stats.totalGross,
      totalExpectedNet: stats.totalExpectedNet,
      totalActualFromBank: stats.totalActualBank,
      totalMarketingFee: stats.totalMarketingFee,
      matchedCount: stats.matched,
      discrepancyCount: stats.discrepancy,
      needsReviewCount: stats.needsReview,
      results,
    }

    logInfo('Daily reconciliation complete', {
      companyId,
      dateStr,
      settlements: results.length,
      needsReview: stats.needsReview
    })

    return summary
  }

  /**
   * Get fee discrepancies report for Finance review
   */
  async getDiscrepanciesReport(
    startDate: Date,
    endDate: Date,
    paymentMethodId?: number,
  ): Promise<FeeDiscrepancyRecord[]> {
    const startStr = startDate.toISOString().split('T')[0]
    const endStr   = endDate.toISOString().split('T')[0]

    logInfo('Getting fee discrepancies report', { startStr, endStr, paymentMethodId })

    return this.repo.getFeeDiscrepancies(startStr, endStr, paymentMethodId)
  }

  /**
   * Get daily summary (historical)
   * TODO: Implement from reconciliation_results table after migration
   */
  async getDailySummary(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FeeReconciliationSummary[]> {
    logInfo('Getting daily summary', { companyId, startDate, endDate })
    
    // TODO: Query reconciliation_results table
    // Aggregate by date, payment method
    return []
  }

  // =====================================================
  // BANK-RECON INTEGRATION (unchanged public API)
  // =====================================================
  
  async calculateAndSaveFeeDiscrepancy(aggregateId: string, statementId: string): Promise<void> {
    await this.repo.calculateAndSaveFeeDiscrepancy(aggregateId, statementId)
  }

  async calculateAndSaveFeeDiscrepancyMultiMatch(
    aggregateId: string,
    totalBankAmount: number
  ): Promise<void> {
    await this.repo.calculateAndSaveFeeDiscrepancyMultiMatch(aggregateId, totalBankAmount)
  }

  async resetFeeDiscrepancy(aggregateId: string): Promise<void> {
    await this.repo.resetFeeDiscrepancy(aggregateId)
  }
}

// Singleton with dependency injection
export const feeReconciliationService = new FeeReconciliationService(feeReconciliationRepository)

