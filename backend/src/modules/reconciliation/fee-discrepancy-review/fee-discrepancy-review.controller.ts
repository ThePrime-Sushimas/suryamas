import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '@/middleware/validation.middleware'
import { feeDiscrepancyReviewService } from './fee-discrepancy-review.service'
import type { feeDiscrepancyListSchema, feeDiscrepancySummarySchema, feeDiscrepancyUpdateStatusSchema, feeDiscrepancyCreateCorrectionSchema, feeDiscrepancyUndoCorrectionSchema } from './fee-discrepancy-review.schema'
import { sendSuccess } from '@/utils/response.util'
import { handleError } from '@/utils/error-handler.util'
import { getAccessibleCompanyIds, resolveContextCompanyId } from '@/utils/branch-access.util'

async function feeScope(req: Request) {
  const userId = req.user?.id ?? ''
  const companyIds = await getAccessibleCompanyIds(userId)
  return {
    userId,
    companyIds,
    companyId: resolveContextCompanyId(req.context?.company_id ?? '', companyIds),
  }
}

class FeeDiscrepancyReviewController {

  async list(req: Request, res: Response) {
    try {
      const { query } = (req as ValidatedAuthRequest<typeof feeDiscrepancyListSchema>).validated
      const { companyIds } = await feeScope(req)
      const result = await feeDiscrepancyReviewService.getDiscrepancies(companyIds, query)
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
      const { companyIds } = await feeScope(req)
      const result = await feeDiscrepancyReviewService.getSummary(companyIds, query)
      sendSuccess(res, result)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_fee_discrepancy_summary' })
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof feeDiscrepancyUpdateStatusSchema>).validated
      const { companyIds, companyId, userId } = await feeScope(req)
      if (!userId) throw new Error('User not authenticated')

      const { source, sourceId } = params
      const { status, notes, correctionJournalId } = body

      await feeDiscrepancyReviewService.updateStatus(
        companyIds, companyId, source, sourceId, status, userId, notes, correctionJournalId
      )

      sendSuccess(res, { source, sourceId, status }, 'Status updated')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_fee_discrepancy_status' })
    }
  }

  async createCorrection(req: Request, res: Response) {
    try {
      const { params, body } = (req as ValidatedAuthRequest<typeof feeDiscrepancyCreateCorrectionSchema>).validated
      const { companyIds, companyId, userId } = await feeScope(req)
      if (!userId) throw new Error('User not authenticated')

      const { source, sourceId } = params
      const { lines, notes } = body

      const result = await feeDiscrepancyReviewService.createCorrectionJournal(
        companyIds, companyId, source, sourceId, userId, lines, notes
      )

      sendSuccess(res, result, 'Jurnal koreksi berhasil dibuat')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_fee_correction' })
    }
  }

  async undoCorrection(req: Request, res: Response) {
    try {
      const { params } = (req as ValidatedAuthRequest<typeof feeDiscrepancyUndoCorrectionSchema>).validated
      const { companyIds, companyId, userId } = await feeScope(req)
      if (!userId) throw new Error('User not authenticated')

      const { source, sourceId } = params
      await feeDiscrepancyReviewService.undoCorrection(companyIds, companyId, source, sourceId, userId)

      sendSuccess(res, { source, sourceId }, 'Koreksi berhasil di-undo')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'undo_fee_correction' })
    }
  }
}

export const feeDiscrepancyReviewController = new FeeDiscrepancyReviewController()
