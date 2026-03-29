/**
 * Fee Reconciliation Repository
 * Full database operations implementing IFeeReconciliationRepository
 * Extracted from service.ts DB logic + new methods
 */

import { supabase } from '../../../config/supabase'
import { logInfo, logWarn, logError } from '../../../config/logger'
import { 
  IFeeReconciliationRepository,
  PaymentMethodFeeConfig,
  PosAggregate,
  FeeDiscrepancyParams,
  FeeDiscrepancyMultiParams,
  FeeDiscrepancyRecord
} from './fee-reconciliation.types'
import { marketingFeeService } from './marketing-fee.service'
import type { ReconciliationResult } from './fee-calculation.service'
import {
  FeeConfigNotFoundError,
  NoAggregatedTransactionsError
} from './fee-reconciliation.errors'

export class FeeReconciliationRepository implements IFeeReconciliationRepository {
  
  async getFeeConfigsByCompany(companyId: string): Promise<PaymentMethodFeeConfig[]> {
    logInfo('Fetching fee configs for company', { companyId })
    
    try {
      const { data, error } = await supabase
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
        logError('Error fetching payment method fee configs', { error: error.message, companyId })
        throw new Error(error.message)
      }

      return (data || []).map((pm: any) => ({
        paymentMethodId: pm.id,
        paymentMethodCode: pm.code,
        paymentMethodName: pm.name,
        paymentType: pm.payment_type,
        feePercentage: pm.fee_percentage || 0,
        feeFixedAmount: pm.fee_fixed_amount || 0,
        feeFixedPerTransaction: pm.fee_fixed_per_transaction || false,
      }))
    } catch (error) {
      logError('Failed to get payment method fee configs', { companyId, error: (error as Error).message })
      throw error
    }
  }

  async getFeeConfigsByPaymentMethodId(id: number): Promise<PaymentMethodFeeConfig> {
    logInfo('Fetching fee config for payment method', { paymentMethodId: id })
    
    try {
      const { data, error } = await supabase
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
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()

      if (error) {
        logError('Error fetching payment method config', { error: error.message, id })
        throw new Error(error.message)
      }

      if (!data) {
        throw new FeeConfigNotFoundError(id)
      }

      return {
        paymentMethodId: data.id,
        paymentMethodCode: data.code,
        paymentMethodName: data.name,
        paymentType: data.payment_type,
        feePercentage: data.fee_percentage || 0,
        feeFixedAmount: data.fee_fixed_amount || 0,
        feeFixedPerTransaction: data.fee_fixed_per_transaction || false,
      }
    } catch (error) {
      logError('Failed to get payment method config', { id, error: (error as Error).message })
      throw error
    }
  }

  async getPosAggregatesByPaymentMethodDate(
    paymentMethodId: number,
    date: string
  ): Promise<PosAggregate | null> {
    logInfo('Fetching POS aggregates', { paymentMethodId, date })
    
    try {
      const { data, error } = await supabase
        .from('pos_aggregates') // or aggregated_transactions - check schema
        .select('id, payment_method_id, total_gross_amount, total_transaction_count, transaction_date, company_id')
        .eq('payment_method_id', paymentMethodId)
        .eq('transaction_date', date)
        .maybeSingle()

      if (error) {
        logError('Error getting POS aggregates', { error: error.message, paymentMethodId, date })
        throw new Error(error.message)
      }

      if (!data) {
        logWarn('No POS aggregates found', { paymentMethodId, date })
      }

      return data
    } catch (error) {
      logError('Failed to get POS aggregates', { paymentMethodId, date, error: (error as Error).message })
      throw error
    }
  }

  async getUnreconciledDeposits(
    paymentMethodId: number,
    date: string
  ): Promise<number> {
    logInfo('Fetching unreconciled bank deposits', { paymentMethodId, date })
    
    try {
      const { data, error } = await supabase
        .from('bank_statements')
        .select('credit_amount')
        .eq('payment_method_id', paymentMethodId)
        .eq('transaction_date', date)
        .eq('is_reconciled', false)
        .is('deleted_at', null)

      if (error) {
        logError('Error getting bank deposits', { error: error.message, paymentMethodId, date })
        throw new Error(error.message)
      }

      const totalDeposits = (data || []).reduce((sum: number, record: any) => {
        return sum + (record.credit_amount || 0)
      }, 0)

      logInfo('Bank deposits calculated', { 
        paymentMethodId, 
        date, 
        totalDeposits, 
        recordCount: data?.length || 0 
      })

      return totalDeposits
    } catch (error) {
      logError('Failed to get bank deposits', { paymentMethodId, date, error: (error as Error).message })
      throw error
    }
  }



  async createReconciliationResult(result: ReconciliationResult): Promise<void> {
    logInfo('Creating reconciliation result', { 
      paymentMethodId: result.paymentMethodId,
      date: result.date 
    })
    
    try {
      const { error } = await supabase
        .from('reconciliation_results') // Needs migration
        .upsert({
          reconciliation_id: `${result.paymentMethodId}_${result.date.toISOString().split('T')[0]}`,
          payment_method_id: result.paymentMethodId,
          transaction_date: result.date.toISOString(),
          status: result.needsReview ? 'NEEDS_REVIEW' : 'RECONCILED',
          total_gross: result.totalGross,
          expected_net: result.expectedNet,
          actual_bank: result.actualFromBank,
          difference: result.difference,
          marketing_fee: result.marketingFee,
          created_at: new Date().toISOString(),
        })

      if (error) {
        logWarn('Failed to create reconciliation result', { error: error.message })
        // Fire-and-forget - don't block main flow
      }
    } catch (error) {
      logWarn('Unexpected error creating reconciliation result', { error: (error as Error).message })
    }
  }

  /**
   * Calculate and save fee discrepancy for single-match
   * Called after bank-recon markAsReconciled()
   * Fire-and-forget - don't block reconciliation flow
   */
  async calculateAndSaveFeeDiscrepancy(aggregateId: string, statementId: string): Promise<void> {
    
    try {
      const { data: agg } = await supabase
        .from('aggregated_transactions')
        .select('id, nett_amount, total_fee_amount, payment_method_id')
        .eq('id', aggregateId)
        .single()

      if (!agg) {
        logWarn('calculateAndSaveFeeDiscrepancy: aggregate not found', { aggregateId })
        return
      }

      const { data: stmt } = await supabase
        .from('bank_statements')
        .select('credit_amount, debit_amount')
        .eq('id', statementId)
        .single()

      if (!stmt) {
        logWarn('calculateAndSaveFeeDiscrepancy: statement not found', { statementId })
        return
      }

      const actualFromBank = (stmt.credit_amount || 0) - (stmt.debit_amount || 0)
      const expectedNet = Number(agg.nett_amount)
      const expectedFee = Number(agg.total_fee_amount)

      const feeResult = marketingFeeService.identifyMarketingFee({
        expectedNet,
        actualFromBank,
        paymentMethodCode: String(agg.payment_method_id),
        transactionDate: new Date(),
      })

      const feeDiscrepancy = feeResult.difference
      const actualFeeAmount = expectedFee + feeDiscrepancy

      let note: string | null = null
      if (Math.abs(feeDiscrepancy) >= 1) {
        if (feeDiscrepancy > 0) {
          note = `Bank bayar kurang Rp ${feeDiscrepancy.toLocaleString('id-ID')} dari expected — marketing fee (${feeResult.confidence} confidence)`
        } else {
          note = `Bank bayar lebih Rp ${Math.abs(feeDiscrepancy).toLocaleString('id-ID')} dari expected — platform promo`
        }
      }

      const { error } = await supabase
        .from('aggregated_transactions')
        .update({
          actual_fee_amount: actualFeeAmount,
          fee_discrepancy: feeDiscrepancy,
          fee_discrepancy_note: note,
          updated_at: new Date().toISOString(),
        })
        .eq('id', aggregateId)

      if (error) {
        logError('calculateAndSaveFeeDiscrepancy: update failed', { aggregateId, error: error.message })
        return
      }

      if (Math.abs(feeDiscrepancy) >= 1) {
        logInfo('Fee discrepancy saved', { aggregateId, statementId, feeDiscrepancy, confidence: feeResult.confidence })
      }
    } catch (error) {
      // Fire-and-forget: don't block main reconciliation
      logError('calculateAndSaveFeeDiscrepancy: unexpected error', { aggregateId, statementId, error: (error as Error).message })
    }
  }

  /**
   * Multi-match version
   * Called after markStatementsAsReconciledWithGroup()
   */
  async calculateAndSaveFeeDiscrepancyMultiMatch(aggregateId: string, totalBankAmount: number): Promise<void> {
    
    try {
      const { data: agg } = await supabase
        .from('aggregated_transactions')
        .select('id, nett_amount, total_fee_amount, payment_method_id')
        .eq('id', aggregateId)
        .single()

      if (!agg) {
        logWarn('calculateAndSaveFeeDiscrepancyMultiMatch: aggregate not found', { aggregateId })
        return
      }

      const expectedNet = Number(agg.nett_amount)
      const expectedFee = Number(agg.total_fee_amount)

      const feeResult = marketingFeeService.identifyMarketingFee({
        expectedNet,
        actualFromBank: totalBankAmount,
        paymentMethodCode: String(agg.payment_method_id),
        transactionDate: new Date(),
      })

      const feeDiscrepancy = feeResult.difference
      const actualFeeAmount = expectedFee + feeDiscrepancy

      let note: string | null = null
      if (Math.abs(feeDiscrepancy) >= 1) {
        note = feeDiscrepancy > 0
          ? `Multi-match: bank bayar kurang Rp ${feeDiscrepancy.toLocaleString('id-ID')} — marketing fee`
          : `Multi-match: bank bayar lebih Rp ${Math.abs(feeDiscrepancy).toLocaleString('id-ID')} — platform promo`
      }

      const { error } = await supabase
        .from('aggregated_transactions')
        .update({
          actual_fee_amount: actualFeeAmount,
          fee_discrepancy: feeDiscrepancy,
          fee_discrepancy_note: note,
          updated_at: new Date().toISOString(),
        })
        .eq('id', aggregateId)

      if (error) {
        logError('calculateAndSaveFeeDiscrepancyMultiMatch: update failed', { aggregateId, error: error.message })
        return
      }

      logInfo('Multi-match fee discrepancy saved', { aggregateId, totalBankAmount, feeDiscrepancy })
    } catch (error) {
      logError('calculateAndSaveFeeDiscrepancyMultiMatch: unexpected error', { 
        aggregateId, 
        totalBankAmount, 
        error: (error as Error).message 
      })
    }
  }

  async getFeeDiscrepancies(
    startDate: string,
    endDate: string,
    paymentMethodId?: number,
  ): Promise<FeeDiscrepancyRecord[]> {
    let query = supabase
      .from('aggregated_transactions')
      .select(`
        id,
        transaction_date,
        payment_method_id,
        gross_amount,
        nett_amount,
        total_fee_amount,
        actual_fee_amount,
        fee_discrepancy,
        fee_discrepancy_note,
        reconciliation_status,
        payment_methods (
          id,
          code,
          name
        )
      `)
      .eq('reconciliation_status', 'RECONCILED')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })

    if (paymentMethodId) {
      query = query.eq('payment_method_id', paymentMethodId)
    }

    const { data, error } = await query

    if (error) {
      logError('getFeeDiscrepancies: failed', { error: error.message })
      throw new Error(error.message)
    }

    return (data || []).map((row: any) => ({
      aggregateId:        row.id,
      transactionDate:    row.transaction_date,
      paymentMethodId:    row.payment_method_id,
      paymentMethodCode:  row.payment_methods?.code ?? null,
      paymentMethodName:  row.payment_methods?.name ?? null,
      grossAmount:        Number(row.gross_amount),
      nettAmount:         Number(row.nett_amount),
      expectedFee:        Number(row.total_fee_amount),
      actualFee:          row.actual_fee_amount != null ? Number(row.actual_fee_amount) : null,
      feeDiscrepancy:     row.fee_discrepancy != null ? Number(row.fee_discrepancy) : null,
      feeDiscrepancyNote: row.fee_discrepancy_note ?? null,
    }))
  }
}

export const feeReconciliationRepository = new FeeReconciliationRepository()
