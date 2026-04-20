import { Response } from 'express'
import { trialBalanceService } from './trial-balance.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { trialBalanceQuerySchema } from './trial-balance.schema'
import type { AuthenticatedRequest } from '../../../types/request.types'

export class TrialBalanceController {
  
  private getCompanyId(req: AuthenticatedRequest): string {
    const companyId = (req as any).context?.company_id
    if (!companyId) {
      throw new Error('Branch context required - no company access')
    }
    return companyId
  }

  async get(req: ValidatedAuthRequest<typeof trialBalanceQuerySchema>, res: Response) {
    try {
      // Mengambil company_id yang aman dari branch context
      const companyId = this.getCompanyId(req as any)
      
      const { date_from, date_to, branch_id } = req.validated.query

      const rows = await trialBalanceService.getTrialBalance({
        companyId,
        dateFrom: date_from,
        dateTo: date_to,
        branchId: branch_id
      })

      sendSuccess(res, rows, 'Trial balance retrieved', 200)
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const trialBalanceController = new TrialBalanceController()
