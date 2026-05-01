/**
 * Fee Reconciliation Controller
 * Thin HTTP handlers delegating to service
 */

import { Request, Response } from 'express'
import { handleError } from '../../../utils/error-handler.util'
import { feeReconciliationService } from './fee-reconciliation.service'
import { reconcileDailySchema, dailySummaryQuerySchema } from './fee-reconciliation.schema'
import { createPaginatedResponse } from '../../../utils/pagination.util'
import type { ReconcileDailyRequest, DailySummaryQuery } from './fee-reconciliation.types'

export class FeeReconciliationController {
  
  /**
   * POST /reconciliation/fee/daily
   * Reconcile all payment methods for company on specific date
   */
  async reconcileDaily(req: Request<{}, any, ReconcileDailyRequest>, res: Response): Promise<void> {
    try {
      const { companyId, date, tolerancePercentage } = req.body
      const parsedDate = new Date(date)

      const summary = await feeReconciliationService.reconcileDaily(
        companyId,
        parsedDate,
        tolerancePercentage
      )

      res.status(200).json({
        success: true,
        data: summary,
        message: `Reconciled ${summary.totalSettlements} payment methods for ${date}`
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reconcile_daily' })
    }
  }

  /**
   * GET /reconciliation/fee/daily-summary
   */
  async getDailySummary(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, startDate, endDate } = req.query as Record<string, string>
      const parsedStart = new Date(startDate)
      const parsedEnd = new Date(endDate)

      const summaries = await feeReconciliationService.getDailySummary(
        companyId,
        parsedStart,
        parsedEnd
      )

      res.status(200).json({
        success: true,
        data: summaries,
        count: summaries.length
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_daily_summary' })
    }
  }

  /**
   * GET /reconciliation/fee/discrepancies
   * Get transactions needing manual review
   */
  async getDiscrepancies(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, paymentMethodId } = req.query as {
        startDate?:      string
        endDate?:        string
        paymentMethodId?: string
      }

      // Default: bulan ini
      const today    = new Date()
      const start    = startDate
        ? new Date(startDate)
        : new Date(today.getFullYear(), today.getMonth(), 1)
      const end      = endDate ? new Date(endDate) : today
      const pmId     = paymentMethodId && !isNaN(parseInt(paymentMethodId))
        ? parseInt(paymentMethodId)
        : undefined

      const records = await feeReconciliationService.getDiscrepanciesReport(start, end, pmId)

      // Summary untuk Finance
      const summary = {
        totalRecords:          records.length,
        totalGross:            records.reduce((s, r) => s + r.grossAmount, 0),
        totalExpectedFee:      records.reduce((s, r) => s + r.expectedFee, 0),
        totalActualFee:        records.reduce((s, r) => s + (r.actualFee ?? 0), 0),
        totalFeeDiscrepancy:   records.reduce((s, r) => s + (r.feeDiscrepancy ?? 0), 0),
        recordsWithDiscrepancy: records.filter(r => r.feeDiscrepancy !== null && r.feeDiscrepancy !== 0).length,
        recordsPending:         records.filter(r => r.feeDiscrepancy === null).length,
      }

      res.status(200).json({
        success: true,
        data:    records,
        summary,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_discrepancies' })
    }
  }
}

export const feeReconciliationController = new FeeReconciliationController()

