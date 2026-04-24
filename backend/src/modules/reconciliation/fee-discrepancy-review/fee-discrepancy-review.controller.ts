import type { Response } from 'express'
import type { ValidatedAuthRequest } from '@/middleware/validation.middleware'
import { feeDiscrepancyReviewService } from './fee-discrepancy-review.service'
import type { feeDiscrepancyListSchema, feeDiscrepancySummarySchema } from './fee-discrepancy-review.schema'
import { sendSuccess } from '@/utils/response.util'
import { handleError } from '@/utils/error-handler.util'

class FeeDiscrepancyReviewController {
  private getCompanyId(req: ValidatedAuthRequest<typeof feeDiscrepancyListSchema | typeof feeDiscrepancySummarySchema>): string {
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
}

export const feeDiscrepancyReviewController = new FeeDiscrepancyReviewController()
