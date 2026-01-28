/**
 * Fee Reconciliation Service
 * Handles fee reconciliation between expected and actual fees
 * 
 * Flow:
 * 1. POS IMPORT → AGGREGATED (per payment method)
 * 2. HITUNG EXPECTED: Gross - (percentage_fee + fixed_fee)
 * 3. COMPARE: Expected vs Actual dari mutasi bank
 * 4. SELISIH = Marketing Fee (input manual)
 * 
 * @see PAYMENT_METHOD_FEE_MD.md for detailed documentation
 */

import { 
  paymentMethodsRepository 
} from '../../payment-methods/payment-methods.repository'
import { 
  feeCalculationService, 
  FeeConfig,
  FeeCalculationResult,
  BatchFeeResult,
  ReconciliationResult
} from './fee-calculation.service'
import { logInfo, logWarn, logError } from '../../../config/logger'
import { supabase } from '../../../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fee configuration dari payment method (3 kolom saja)
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
 * Settlement transaction agregat
 */
export interface SettlementTransaction {
  settlement_id: string
  payment_method_id: number
  gross_amount: number
  transaction_count: number
  transaction_date: Date
}

/**
 * Bank statement record
 */
export interface BankStatementRecord {
  id: string
  bank_account_id: number
  transaction_date: Date
  credit_amount: number
  description: string
  payment_method_id?: number
}

/**
 * Reconciliation summary result
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

// ============================================================================
// FEE RECONCILIATION SERVICE
// ============================================================================

export class FeeReconciliationService {
  
  /**
   * Ambil fee configuration dari payment methods untuk company
   */
  async getPaymentMethodFeeConfigs(companyId: string): Promise<PaymentMethodFeeConfig[]> {
    logInfo('Mengambil fee configs dari payment methods', { companyId })
    
    try {
      const { data: paymentMethods, error } = await supabase
        .from('payment_methods')
        .select(`
          id,
          code,
          name,
          payment_type,
          fee_percentage,
          fee_fixed_amount,
          fee_fixed_per_transaction
        `)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .is('deleted_at', null)

      if (error) {
        logError('Error mengambil payment methods', { error: error.message })
        throw new Error(error.message)
      }

      return (paymentMethods || []).map(pm => ({
        paymentMethodId: pm.id,
        paymentMethodCode: pm.code,
        paymentMethodName: pm.name,
        paymentType: pm.payment_type,
        feePercentage: pm.fee_percentage || 0,
        feeFixedAmount: pm.fee_fixed_amount || 0,
        feeFixedPerTransaction: pm.fee_fixed_per_transaction || false
      }))
    } catch (error) {
      logError('Failed to get payment method fee configs', { 
        companyId, 
        error: (error as Error).message 
      })
      throw error
    }
  }

  /**
   * Hitung expected net untuk satu settlement
   */
  calculateExpectedNet(
    grossAmount: number,
    transactionCount: number,
    feeConfig: PaymentMethodFeeConfig
  ): FeeCalculationResult {
    const config: FeeConfig = {
      fee_percentage: feeConfig.feePercentage,
      fee_fixed_amount: feeConfig.feeFixedAmount,
      fee_fixed_per_transaction: feeConfig.feeFixedPerTransaction
    }

    return feeCalculationService.calculateExpectedNet(grossAmount, transactionCount, config)
  }

  /**
   * Reconcile fees untuk satu payment method pada tanggal tertentu
   * 
   * Step 1: Ambil aggregated transactions dari POS
   * Step 2: Hitung expected net
   * Step 3: Ambil actual dari bank
   * Step 4: Calculate difference = marketing fee
   */
  async reconcilePaymentMethod(
    paymentMethodId: number,
    date: Date,
    tolerancePercentage: number = 1
  ): Promise<ReconciliationResult> {
    logInfo('Reconciling payment method', { paymentMethodId, date })

    // 1. Get payment method config
    const feeConfig = await this.getPaymentMethodConfig(paymentMethodId)

    // 2. Get aggregated transactions (TODO: implement dari database)
    const aggregated = await this.getAggregatedTransactions(paymentMethodId, date)

    // 3. Calculate expected net
    const expectedResult = this.calculateExpectedNet(
      aggregated.totalAmount,
      aggregated.transactionCount,
      feeConfig
    )

    // 4. Get actual from bank statement (TODO: implement dari database)
    const actualFromBank = await this.getBankDeposits(paymentMethodId, date)

    // 5. Calculate marketing fee (difference)
    const marketingCalc = feeCalculationService.calculateMarketingFee(
      expectedResult.expectedNet,
      actualFromBank,
      tolerancePercentage
    )

    return {
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
      difference: marketingCalc.difference,
      marketingFee: marketingCalc.marketingFee,
      isWithinTolerance: marketingCalc.isWithinTolerance,
      needsReview: marketingCalc.needsReview
    }
  }

  /**
   * Reconcile semua payment methods untuk tanggal tertentu
   */
  async reconcileDaily(
    date: Date,
    companyId: string,
    tolerancePercentage: number = 1
  ): Promise<FeeReconciliationSummary> {
    logInfo('Reconciling daily transactions', { date, companyId })

    // 1. Get all active payment methods dengan fee configs
    const feeConfigs = await this.getPaymentMethodFeeConfigs(companyId)

    // 2. Reconcile each payment method
    const results: ReconciliationResult[] = []
    let totalGross = 0
    let totalExpectedNet = 0
    let totalActualFromBank = 0
    let totalMarketingFee = 0
    let matchedCount = 0
    let discrepancyCount = 0
    let needsReviewCount = 0

    for (const feeConfig of feeConfigs) {
      const result = await this.reconcilePaymentMethod(
        feeConfig.paymentMethodId,
        date,
        tolerancePercentage
      )

      results.push(result)

      totalGross += result.totalGross
      totalExpectedNet += result.expectedNet
      totalActualFromBank += result.actualFromBank
      totalMarketingFee += result.marketingFee

      if (result.isWithinTolerance) {
        matchedCount++
      } else {
        discrepancyCount++
      }

      if (result.needsReview) {
        needsReviewCount++
      }
    }

    return {
      date,
      totalSettlements: results.length,
      totalGrossAmount: totalGross,
      totalExpectedNet,
      totalActualFromBank,
      totalMarketingFee,
      matchedCount,
      discrepancyCount,
      needsReviewCount,
      results
    }
  }

  /**
   * Approve marketing fee (manual review)
   */
  async approveMarketingFee(
    reconciliationId: string,
    approvedBy: string,
    approvedAmount?: number
  ): Promise<void> {
    logInfo('Approving marketing fee', { 
      reconciliationId, 
      approvedBy, 
      approvedAmount 
    })
    
    // TODO: Implement update di database
    // UPDATE reconciliation_results SET status = 'APPROVED', approved_by = $1, approved_amount = COALESCE($2, marketing_fee)
  }

  /**
   * Reject marketing fee (manual review)
   */
  async rejectMarketingFee(
    reconciliationId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    logInfo('Rejecting marketing fee', { reconciliationId, rejectedBy, reason })
    
    // TODO: Implement update di database
    // UPDATE reconciliation_results SET status = 'REJECTED', rejection_reason = $1
  }

  // ============================================================================
  // PRIVATE METHODS (TODO: Implementasi database)
  // ============================================================================

  /**
   * Get payment method config by ID
   */
  private async getPaymentMethodConfig(paymentMethodId: number): Promise<PaymentMethodFeeConfig> {
    // TODO: Implement dari database
    const { data, error } = await supabase
      .from('payment_methods')
      .select(`
        id, code, name, payment_type,
        fee_percentage, fee_fixed_amount, fee_fixed_per_transaction
      `)
      .eq('id', paymentMethodId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) {
      throw new Error(`Payment method ${paymentMethodId} not found`)
    }

    return {
      paymentMethodId: data.id,
      paymentMethodCode: data.code,
      paymentMethodName: data.name,
      paymentType: data.payment_type,
      feePercentage: data.fee_percentage || 0,
      feeFixedAmount: data.fee_fixed_amount || 0,
      feeFixedPerTransaction: data.fee_fixed_per_transaction || false
    }
  }

  /**
   * Get aggregated transactions untuk payment method dan tanggal
   */
  private async getAggregatedTransactions(
    paymentMethodId: number,
    date: Date
  ): Promise<{ totalAmount: number; transactionCount: number }> {
    // TODO: Implement dari pos_aggregates atau settlement_transactions table
    // SELECT SUM(gross_amount) as total_amount, COUNT(*) as transaction_count
    // FROM settlement_transactions
    // WHERE payment_method_id = $1 AND transaction_date = $2
    return { totalAmount: 0, transactionCount: 0 }
  }

  /**
   * Get actual deposits dari bank untuk payment method dan tanggal
   */
  private async getBankDeposits(
    paymentMethodId: number,
    date: Date
  ): Promise<number> {
    // TODO: Implement dari bank_statements table
    // SELECT SUM(credit_amount) as total
    // FROM bank_statements
    // WHERE payment_method_id = $1 AND transaction_date = $2
    return 0
  }

  /**
   * Get daily reconciliation summary
   */
  async getDailySummary(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FeeReconciliationSummary[]> {
    logInfo('Getting daily summary', { companyId, startDate, endDate })
    
    // TODO: Implement aggregation dari reconciliation_results table
    return []
  }
}

// Export instance
export const feeReconciliationService = new FeeReconciliationService()

