/**
 * Fee Reconciliation Controller
 * Thin HTTP handlers delegating to service
 */

import { Request, Response, NextFunction } from 'express'
import { feeReconciliationService } from './fee-reconciliation.service'
import { reconcileDailySchema, dailySummaryQuerySchema, approveMarketingFeeSchema } from './fee-reconciliation.schema'
import { createPaginatedResponse } from '../../../utils/pagination.util'
import type { ReconcileDailyRequest, DailySummaryQuery, ApproveMarketingFeeRequest } from './fee-reconciliation.types'

export class FeeReconciliationController {
  
  /**
   * POST /reconciliation/fee/daily
   * Reconcile all payment methods for company on specific date
   */
  async reconcileDaily(req: Request<{}, any, ReconcileDailyRequest>, res: Response): Promise<void> {
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
  }

  /**
   * GET /reconciliation/fee/daily-summary
   */
  async getDailySummary(req: Request<{}, any, any, DailySummaryQuery>, res: Response): Promise<void> {
    const { companyId, startDate, endDate } = req.query
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
  }

  /**
   * POST /reconciliation/fee/:id/approve
   */
  async approveMarketingFee(req: Request<{}, any, ApproveMarketingFeeRequest>, res: Response): Promise<void> {
    const { reconciliationId, approvedBy, approvedAmount } = req.body

    await feeReconciliationService.approveMarketingFee(
      reconciliationId,
      approvedBy,
      approvedAmount
    )

    res.status(200).json({
      success: true,
      message: `Marketing fee for ${reconciliationId} approved`,
      data: { reconciliationId, approvedBy, approvedAmount }
    })
  }

  /**
   * POST /reconciliation/fee/:id/reject
   */
  async rejectMarketingFee(req: Request, res: Response): Promise<void> {
    // Parse from path params + body
    const { reconciliationId } = req.params as { reconciliationId: string }
    const { rejectedBy, reason } = req.body

    await feeReconciliationService.rejectMarketingFee(
      reconciliationId,
      rejectedBy,
      reason
    )

    res.status(200).json({
      success: true,
      message: `Marketing fee for ${reconciliationId} rejected`,
      data: { reconciliationId, rejectedBy }
    })
  }

  /**
   * GET /reconciliation/fee/discrepancies
   * Get transactions needing manual review
   */
  async getDiscrepancies(req: Request, res: Response): Promise<void> {
    // TODO: Implement using service.getDailySummary() + filter needsReview
    // Add pagination, filters (date, company, threshold)
    
    res.status(200).json({
      success: true,
      data: [],
      message: 'Not implemented yet'
    })
  }
}

export const feeReconciliationController = new FeeReconciliationController()

