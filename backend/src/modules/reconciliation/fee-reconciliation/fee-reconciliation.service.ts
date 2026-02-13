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

    try {
      // First, get the reconciliation result to understand what we're approving
      // For now, we'll assume reconciliationId is a combination of payment_method_id and date
      const [paymentMethodIdStr, dateStr] = reconciliationId.split('_')
      const paymentMethodId = parseInt(paymentMethodIdStr)
      const date = new Date(dateStr)

      if (isNaN(paymentMethodId) || isNaN(date.getTime())) {
        throw new Error('Invalid reconciliation ID format')
      }

      // Get the current reconciliation result
      const result = await this.reconcilePaymentMethod(paymentMethodId, date)

      // Mark bank statements as reconciled for this payment method and date
      const dateString = date.toISOString().split('T')[0]
      const { error: updateError } = await supabase
        .from('bank_statements')
        .update({
          is_reconciled: true,
          reconciliation_id: reconciliationId,
          updated_at: new Date().toISOString(),
          updated_by: approvedBy
        })
        .eq('payment_method_id', paymentMethodId)
        .eq('transaction_date', dateString)
        .eq('is_reconciled', false)
        .is('deleted_at', null)

      if (updateError) {
        logError('Error updating bank statements for approval', { error: updateError.message })
        throw new Error(updateError.message)
      }

      // TODO: Optionally create a reconciliation_results record
      // const { error: insertError } = await supabase
      //   .from('reconciliation_results')
      //   .insert({
      //     reconciliation_id: reconciliationId,
      //     payment_method_id: paymentMethodId,
      //     transaction_date: dateString,
      //     status: 'APPROVED',
      //     approved_amount: approvedAmount || result.marketingFee,
      //     approved_by: approvedBy,
      //     created_at: new Date().toISOString()
      //   })

      logInfo('Marketing fee approved successfully', {
        reconciliationId,
        approvedBy,
        approvedAmount: approvedAmount || result.marketingFee
      })

    } catch (error) {
      logError('Failed to approve marketing fee', {
        reconciliationId,
        approvedBy,
        error: (error as Error).message
      })
      throw error
    }
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

    try {
      // Parse reconciliation ID (assuming format: paymentMethodId_date)
      const [paymentMethodIdStr, dateStr] = reconciliationId.split('_')
      const paymentMethodId = parseInt(paymentMethodIdStr)
      const date = new Date(dateStr)

      if (isNaN(paymentMethodId) || isNaN(date.getTime())) {
        throw new Error('Invalid reconciliation ID format')
      }

      // Mark bank statements as reconciled with rejection status
      const dateString = date.toISOString().split('T')[0]
      const { error: updateError } = await supabase
        .from('bank_statements')
        .update({
          is_reconciled: true,
          reconciliation_id: reconciliationId,
          updated_at: new Date().toISOString(),
          updated_by: rejectedBy
        })
        .eq('payment_method_id', paymentMethodId)
        .eq('transaction_date', dateString)
        .eq('is_reconciled', false)
        .is('deleted_at', null)

      if (updateError) {
        logError('Error updating bank statements for rejection', { error: updateError.message })
        throw new Error(updateError.message)
      }

      // TODO: Optionally create a reconciliation_results record with rejection
      // const { error: insertError } = await supabase
      //   .from('reconciliation_results')
      //   .insert({
      //     reconciliation_id: reconciliationId,
      //     payment_method_id: paymentMethodId,
      //     transaction_date: dateString,
      //     status: 'REJECTED',
      //     rejection_reason: reason,
      //     rejected_by: rejectedBy,
      //     created_at: new Date().toISOString()
      //   })

      logInfo('Marketing fee rejected successfully', {
        reconciliationId,
        rejectedBy,
        reason
      })

    } catch (error) {
      logError('Failed to reject marketing fee', {
        reconciliationId,
        rejectedBy,
        reason,
        error: (error as Error).message
      })
      throw error
    }
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
    logInfo('Getting aggregated transactions', { paymentMethodId, date })

    try {
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format

      // Query pos_aggregates table untuk aggregated transactions
      const { data, error } = await supabase
        .from('pos_aggregates')
        .select('total_gross_amount, total_transaction_count')
        .eq('payment_method_id', paymentMethodId)
        .eq('transaction_date', dateStr)
        .maybeSingle()

      if (error) {
        logError('Error getting aggregated transactions', { error: error.message, paymentMethodId, date })
        throw new Error(error.message)
      }

      return {
        totalAmount: data?.total_gross_amount || 0,
        transactionCount: data?.total_transaction_count || 0
      }
    } catch (error) {
      logError('Failed to get aggregated transactions', {
        paymentMethodId,
        date,
        error: (error as Error).message
      })
      throw error
    }
  }

  /**
   * Get actual deposits dari bank untuk payment method dan tanggal
   */
  private async getBankDeposits(
    paymentMethodId: number,
    date: Date
  ): Promise<number> {
    logInfo('Getting bank deposits', { paymentMethodId, date })

    try {
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format

      // Query bank_statements table untuk total credit amounts (deposits)
      const { data, error } = await supabase
        .from('bank_statements')
        .select('credit_amount')
        .eq('payment_method_id', paymentMethodId)
        .eq('transaction_date', dateStr)
        .eq('is_reconciled', false) // Only unreconciled transactions
        .is('deleted_at', null)

      if (error) {
        logError('Error getting bank deposits', { error: error.message, paymentMethodId, date })
        throw new Error(error.message)
      }

      // Sum all credit amounts
      const totalDeposits = (data || []).reduce((sum, record) => sum + (record.credit_amount || 0), 0)

      logInfo('Bank deposits calculated', { paymentMethodId, date, totalDeposits, recordCount: data?.length || 0 })

      return totalDeposits
    } catch (error) {
      logError('Failed to get bank deposits', {
        paymentMethodId,
        date,
        error: (error as Error).message
      })
      throw error
    }
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

