import { Request, Response } from 'express'
import { trialBalanceService } from './trial-balance.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { trialBalanceQuerySchema } from './trial-balance.schema'

export class TrialBalanceController {
  private getCompanyId(req: Request): string {
    const companyId = req.context?.company_id
    if (!companyId) throw new Error('Branch context required - no company access')
    return companyId
  }

  async get(req: ValidatedAuthRequest<typeof trialBalanceQuerySchema>, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const { date_from, date_to, branch_ids } = req.validated.query

      const branchIds = branch_ids
        ? branch_ids.split(',').map(s => s.trim()).filter(Boolean)
        : undefined

      const rows = await trialBalanceService.getTrialBalance({
        companyId,
        dateFrom: date_from,
        dateTo: date_to,
        branchIds,
      })

      sendSuccess(res, rows, 'Trial balance retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_trial_balance', company_id: req.context?.company_id })
    }
  }
}

export const trialBalanceController = new TrialBalanceController()
