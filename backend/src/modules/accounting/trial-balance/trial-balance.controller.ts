import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { trialBalanceService } from './trial-balance.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { trialBalanceQuerySchema } from './trial-balance.schema'
import { getAccessibleBranchIds, getAccessibleCompanyIds, requireBranchAccess } from '../../../utils/branch-access.util'

export class TrialBalanceController {
  async get(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const [companyIds, accessibleBranchIds] = await Promise.all([
        getAccessibleCompanyIds(userId),
        getAccessibleBranchIds(userId),
      ])

      const { query } = (req as ValidatedAuthRequest<typeof trialBalanceQuerySchema>).validated
      const { date_from, date_to, branch_ids } = query

      let branchFilterIds: string[]
      let groupByBranch: boolean
      if (branch_ids) {
        branchFilterIds = branch_ids.split(',').map(s => s.trim()).filter(Boolean)
        for (const id of branchFilterIds) requireBranchAccess(id, accessibleBranchIds)
        groupByBranch = branchFilterIds.length > 0
      } else {
        branchFilterIds = accessibleBranchIds
        groupByBranch = false
      }

      const rows = await trialBalanceService.getTrialBalance({
        companyIds,
        dateFrom: date_from,
        dateTo: date_to,
        branchFilterIds,
        groupByBranch,
      })

      sendSuccess(res, rows, 'Trial balance retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_trial_balance' })
    }
  }
}

export const trialBalanceController = new TrialBalanceController()
