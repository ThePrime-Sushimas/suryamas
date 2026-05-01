import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '@/middleware/validation.middleware'
import { feeDiscrepancyReviewService } from './fee-discrepancy-review.service'
import type { feeDiscrepancyListSchema, feeDiscrepancySummarySchema, feeDiscrepancyUpdateStatusSchema, feeDiscrepancyCreateCorrectionSchema, feeDiscrepancyUndoCorrectionSchema } from './fee-discrepancy-review.schema'
import { sendSuccess } from '@/utils/response.util'
import { handleError } from '@/utils/error-handler.util'

class FeeDiscrepancyReviewController {
  private getCompanyId(req: Request): string {
    const companyId = req.context?.company_id
    if (!companyId) throw new Error('Branch context required - no company access')
    return companyId
  }

  async list(req: Request, res: Response) {
    try {
      const { query } = (req as ValidatedAuthRequest<typeof feeDiscrepancyListSchema>).validated
      const companyId = this.getCompanyId(req)
      const result = await feeDiscrepancyReviewService.getDiscrepancies(companyId, query)
      sendSuccess(res, result.data, 'Fee discrepancies fetched', 200, {
        total: result.total,
        page: query.page,
        limit: query.limit,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_fee_discrepancies' })
    }
  }

  async summary(req: Request, res: Response) {
    try {
      const { query } = (req as ValidatedAuthRequest<typeof feeDiscrepancySummarySchema>).validated
      const companyId = this.getCompanyId(req)
      const result = await feeDiscrepancyReviewService.getSummary(companyId, query)
      sendSuccess(res, result)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_fee_discrepancy_summary' })
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof feeDiscrepancyUpdateStatusSchema>).validated
      const companyId = this.getCompanyId(req)
      const userId = req.user?.id
      if (!userId) throw new Error('User not authenticated')

      const { source, sourceId } = params
      const { status, notes, correctionJournalId } = body

      await feeDiscrepancyReviewService.updateStatus(
        companyId, source, sourceId, status, userId, notes, correctionJournalId
      )

      sendSuccess(res, { source, sourceId, status }, 'Status updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_fee_discrepancy_status' })
    }
  }

  async createCorrection(req: Request, res: Response) {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof feeDiscrepancyCreateCorrectionSchema>).validated
      const companyId = this.getCompanyId(req)
      const userId = req.user?.id
      if (!userId) throw new Error('User not authenticated')

      const { source, sourceId } = params
      const { lines, notes } = body

      const result = await feeDiscrepancyReviewService.createCorrectionJournal(
        companyId, source, sourceId, userId, lines, notes
      )

      sendSuccess(res, result, 'Jurnal koreksi berhasil dibuat')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_fee_correction' })
    }
  }

  async undoCorrection(req: Request, res: Response) {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof feeDiscrepancyUndoCorrectionSchema>).validated
      const companyId = this.getCompanyId(req)
      const userId = req.user?.id
      if (!userId) throw new Error('User not authenticated')

      const { source, sourceId } = params
      await feeDiscrepancyReviewService.undoCorrection(companyId, source, sourceId, userId)

      sendSuccess(res, { source, sourceId }, 'Koreksi berhasil di-undo')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'undo_fee_correction' })
    }
  }
}

export const feeDiscrepancyReviewController = new FeeDiscrepancyReviewController()
