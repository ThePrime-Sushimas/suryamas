import { pool } from '../../../config/db'
import { logInfo, logWarn, logError } from '../../../config/logger'
import {
  IFeeReconciliationRepository,
  PaymentMethodFeeConfig,
  PosAggregate,
  FeeDiscrepancyRecord
} from './fee-reconciliation.types'
import { marketingFeeService } from './marketing-fee.service'
import type { ReconciliationResult } from './fee-calculation.service'
import { FeeConfigNotFoundError } from './fee-reconciliation.errors'

export class FeeReconciliationRepository implements IFeeReconciliationRepository {

  async getFeeConfigsByCompany(companyId: string): Promise<PaymentMethodFeeConfig[]> {
    const { rows } = await pool.query(
      `SELECT id, code, name, payment_type, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction
       FROM payment_methods
       WHERE company_id = $1 AND is_active = true AND deleted_at IS NULL`,
      [companyId]
    )
    return rows.map(pm => ({
      paymentMethodId: pm.id,
      paymentMethodCode: pm.code,
      paymentMethodName: pm.name,
      paymentType: pm.payment_type,
      feePercentage: pm.fee_percentage || 0,
      feeFixedAmount: pm.fee_fixed_amount || 0,
      feeFixedPerTransaction: pm.fee_fixed_per_transaction || false,
    }))
  }

  async getFeeConfigsByPaymentMethodId(id: number): Promise<PaymentMethodFeeConfig> {
    const { rows } = await pool.query(
      `SELECT id, code, name, payment_type, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction
       FROM payment_methods WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    )
    if (rows.length === 0) throw new FeeConfigNotFoundError(id)
    const pm = rows[0]
    return {
      paymentMethodId: pm.id,
      paymentMethodCode: pm.code,
      paymentMethodName: pm.name,
      paymentType: pm.payment_type,
      feePercentage: pm.fee_percentage || 0,
      feeFixedAmount: pm.fee_fixed_amount || 0,
      feeFixedPerTransaction: pm.fee_fixed_per_transaction || false,
    }
  }

  async getPosAggregatesByPaymentMethodDate(paymentMethodId: number, date: string): Promise<PosAggregate | null> {
    const { rows } = await pool.query(
      `SELECT id, payment_method_id, total_gross_amount, total_transaction_count, transaction_date, company_id
       FROM pos_aggregates WHERE payment_method_id = $1 AND transaction_date = $2::date LIMIT 1`,
      [paymentMethodId, date]
    )
    return rows[0] ?? null
  }

  async getUnreconciledDeposits(paymentMethodId: number, date: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(credit_amount), 0)::float AS total
       FROM bank_statements
       WHERE payment_method_id = $1 AND transaction_date = $2::date
         AND is_reconciled = false AND deleted_at IS NULL`,
      [paymentMethodId, date]
    )
    return rows[0]?.total ?? 0
  }

  async createReconciliationResult(result: ReconciliationResult): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO reconciliation_results
         (reconciliation_id, payment_method_id, transaction_date, status,
          total_gross, expected_net, actual_bank, difference, marketing_fee, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (reconciliation_id) DO UPDATE SET
           status = EXCLUDED.status, total_gross = EXCLUDED.total_gross,
           expected_net = EXCLUDED.expected_net, actual_bank = EXCLUDED.actual_bank,
           difference = EXCLUDED.difference, marketing_fee = EXCLUDED.marketing_fee`,
        [
          `${result.paymentMethodId}_${result.date.toISOString().split('T')[0]}`,
          result.paymentMethodId,
          result.date.toISOString(),
          result.needsReview ? 'NEEDS_REVIEW' : 'RECONCILED',
          result.totalGross, result.expectedNet, result.actualFromBank,
          result.difference, result.marketingFee,
        ]
      )
    } catch (error) {
      logWarn('Failed to create reconciliation result', { error: (error as Error).message })
    }
  }

  async calculateAndSaveFeeDiscrepancy(aggregateId: string, statementId: string): Promise<void> {
    try {
      const { rows: aggRows } = await pool.query(
        `SELECT id, nett_amount, total_fee_amount, payment_method_id
         FROM aggregated_transactions WHERE id = $1`,
        [aggregateId]
      )
      const agg = aggRows[0]
      if (!agg) { logWarn('calculateAndSaveFeeDiscrepancy: aggregate not found', { aggregateId }); return }

      const { rows: stmtRows } = await pool.query(
        `SELECT credit_amount, debit_amount FROM bank_statements WHERE id = $1`,
        [statementId]
      )
      const stmt = stmtRows[0]
      if (!stmt) { logWarn('calculateAndSaveFeeDiscrepancy: statement not found', { statementId }); return }

      const actualFromBank = (Number(stmt.credit_amount) || 0) - (Number(stmt.debit_amount) || 0)
      const expectedNet = Number(agg.nett_amount)
      const expectedFee = Number(agg.total_fee_amount)

      const feeResult = marketingFeeService.identifyMarketingFee({
        expectedNet, actualFromBank,
        paymentMethodCode: String(agg.payment_method_id),
        transactionDate: new Date(),
      })

      const feeDiscrepancy = feeResult.difference
      const actualFeeAmount = expectedFee + feeDiscrepancy

      let note: string | null = null
      if (Math.abs(feeDiscrepancy) >= 1) {
        note = feeDiscrepancy > 0
          ? `Bank bayar kurang Rp ${feeDiscrepancy.toLocaleString('id-ID')} dari expected — marketing fee (${feeResult.confidence} confidence)`
          : `Bank bayar lebih Rp ${Math.abs(feeDiscrepancy).toLocaleString('id-ID')} dari expected — platform promo`
      }

      await pool.query(
        `UPDATE aggregated_transactions
         SET actual_fee_amount = $1, fee_discrepancy = $2, fee_discrepancy_note = $3, updated_at = NOW()
         WHERE id = $4`,
        [actualFeeAmount, feeDiscrepancy, note, aggregateId]
      )

      if (Math.abs(feeDiscrepancy) >= 1) {
        logInfo('Fee discrepancy saved', { aggregateId, statementId, feeDiscrepancy, confidence: feeResult.confidence })
      }
    } catch (error) {
      logError('calculateAndSaveFeeDiscrepancy: unexpected error', { aggregateId, statementId, error: (error as Error).message })
    }
  }

  async calculateAndSaveFeeDiscrepancyMultiMatch(aggregateId: string, totalBankAmount: number): Promise<void> {
    try {
      const { rows } = await pool.query(
        `SELECT id, nett_amount, total_fee_amount, payment_method_id
         FROM aggregated_transactions WHERE id = $1`,
        [aggregateId]
      )
      const agg = rows[0]
      if (!agg) { logWarn('calculateAndSaveFeeDiscrepancyMultiMatch: aggregate not found', { aggregateId }); return }

      const expectedNet = Number(agg.nett_amount)
      const expectedFee = Number(agg.total_fee_amount)

      const feeResult = marketingFeeService.identifyMarketingFee({
        expectedNet, actualFromBank: totalBankAmount,
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

      await pool.query(
        `UPDATE aggregated_transactions
         SET actual_fee_amount = $1, fee_discrepancy = $2, fee_discrepancy_note = $3, updated_at = NOW()
         WHERE id = $4`,
        [actualFeeAmount, feeDiscrepancy, note, aggregateId]
      )

      logInfo('Multi-match fee discrepancy saved', { aggregateId, totalBankAmount, feeDiscrepancy })
    } catch (error) {
      logError('calculateAndSaveFeeDiscrepancyMultiMatch: unexpected error', { aggregateId, totalBankAmount, error: (error as Error).message })
    }
  }

  async resetFeeDiscrepancy(aggregateId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE aggregated_transactions
         SET actual_fee_amount = 0, fee_discrepancy = 0, fee_discrepancy_note = '', updated_at = NOW()
         WHERE id = $1`,
        [aggregateId]
      )
    } catch (error) {
      logError('resetFeeDiscrepancy: failed', { aggregateId, error: (error as Error).message })
    }
  }

  async getFeeDiscrepancies(startDate: string, endDate: string, paymentMethodId?: number): Promise<FeeDiscrepancyRecord[]> {
    const conditions = [
      "at.reconciliation_status = 'RECONCILED'",
      'at.transaction_date >= $1', 'at.transaction_date <= $2',
      'at.deleted_at IS NULL',
    ]
    const values: unknown[] = [startDate, endDate]
    let idx = 3

    if (paymentMethodId) {
      conditions.push(`at.payment_method_id = $${idx++}`)
      values.push(paymentMethodId)
    }

    const { rows } = await pool.query(
      `SELECT at.id, at.transaction_date, at.payment_method_id,
              at.gross_amount, at.nett_amount, at.total_fee_amount,
              at.actual_fee_amount, at.fee_discrepancy, at.fee_discrepancy_note,
              pm.code AS pm_code, pm.name AS pm_name
       FROM aggregated_transactions at
       LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY at.transaction_date DESC`,
      values
    )

    return rows.map(row => ({
      aggregateId: row.id,
      transactionDate: row.transaction_date,
      paymentMethodId: row.payment_method_id,
      paymentMethodCode: row.pm_code ?? null,
      paymentMethodName: row.pm_name ?? null,
      grossAmount: Number(row.gross_amount),
      nettAmount: Number(row.nett_amount),
      expectedFee: Number(row.total_fee_amount),
      actualFee: row.actual_fee_amount != null ? Number(row.actual_fee_amount) : null,
      feeDiscrepancy: row.fee_discrepancy != null ? Number(row.fee_discrepancy) : null,
      feeDiscrepancyNote: row.fee_discrepancy_note ?? null,
    }))
  }
}

export const feeReconciliationRepository = new FeeReconciliationRepository()
