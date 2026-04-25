import type { Response } from 'express'
import type { ValidatedAuthRequest } from '@/middleware/validation.middleware'
import { feeDiscrepancyReviewService } from './fee-discrepancy-review.service'
import type { feeDiscrepancyListSchema, feeDiscrepancySummarySchema, feeDiscrepancyUpdateStatusSchema, feeDiscrepancyCreateCorrectionSchema, feeDiscrepancyUndoCorrectionSchema } from './fee-discrepancy-review.schema'
import { sendSuccess } from '@/utils/response.util'
import { handleError } from '@/utils/error-handler.util'

class FeeDiscrepancyReviewController {
  private getCompanyId(req: { context?: { company_id: string } }): string {
    const companyId = req.context?.company_id
    if (!companyId) throw new Error('Branch context required - no company access')
    return companyId
  }

  async list(req: ValidatedAuthRequest<typeof feeDiscrepancyListSchema>, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const query = req.validated.query
      const result = await feeDiscrepancyReviewService.getDiscrepancies(companyId, query)
      sendSuccess(res, result.data, 'Fee discrepancies fetched', 200, {
        total: result.total,
        page: query.page,
        limit: query.limit,
      })
    } catch (error) {
      await handleError(res, error)
    }
  }

  async summary(req: ValidatedAuthRequest<typeof feeDiscrepancySummarySchema>, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const result = await feeDiscrepancyReviewService.getSummary(companyId, req.validated.query)
      sendSuccess(res, result)
    } catch (error) {
      await handleError(res, error)
    }
  }

  async updateStatus(req: ValidatedAuthRequest<typeof feeDiscrepancyUpdateStatusSchema>, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const userId = req.user?.id
      if (!userId) throw new Error('User not authenticated')

      const { source, sourceId } = req.validated.params
      const { status, notes, correctionJournalId } = req.validated.body

      await feeDiscrepancyReviewService.updateStatus(
        companyId, source, sourceId, status, userId, notes, correctionJournalId
      )

      sendSuccess(res, { source, sourceId, status }, 'Status updated')
    } catch (error) {
      await handleError(res, error)
    }
  }

  async createCorrection(req: ValidatedAuthRequest<typeof feeDiscrepancyCreateCorrectionSchema>, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const userId = req.user?.id
      if (!userId) throw new Error('User not authenticated')

      const { source, sourceId } = req.validated.params
      const { lines, notes } = req.validated.body

      const result = await feeDiscrepancyReviewService.createCorrectionJournal(
        companyId, source, sourceId, userId, lines, notes
      )

      sendSuccess(res, result, 'Jurnal koreksi berhasil dibuat')
    } catch (error) {
      await handleError(res, error)
    }
  }

  async undoCorrection(req: ValidatedAuthRequest<typeof feeDiscrepancyUndoCorrectionSchema>, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const userId = req.user?.id
      if (!userId) throw new Error('User not authenticated')

      const { source, sourceId } = req.validated.params
      await feeDiscrepancyReviewService.undoCorrection(companyId, source, sourceId, userId)

      sendSuccess(res, { source, sourceId }, 'Koreksi berhasil di-undo')
    } catch (error) {
      await handleError(res, error)
    }
  }
}

export const feeDiscrepancyReviewController = new FeeDiscrepancyReviewController()
