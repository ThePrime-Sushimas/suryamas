import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { trialBalanceService } from './trial-balance.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { trialBalanceQuerySchema } from './trial-balance.schema'

export class TrialBalanceController {
  async get(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      if (!companyId) throw new Error('Branch context required - no company access')

      const { query } = (req as ValidatedAuthRequest<typeof trialBalanceQuerySchema>).validated
      const { date_from, date_to, branch_ids } = query

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
      await handleError(res, error, req, { action: 'get_trial_balance' })
    }
  }
}

export const trialBalanceController = new TrialBalanceController()
