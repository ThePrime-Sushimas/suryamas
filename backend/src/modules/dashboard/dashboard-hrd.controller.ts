import { Request, Response } from 'express'
import { dashboardHrdService } from './dashboard-hrd.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { getAccessibleBranchIds, getAccessibleCompanyIds } from '../../utils/branch-access.util'

class DashboardHrdController {
  async getSummary(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const [companyIds, branchIds] = await Promise.all([
        getAccessibleCompanyIds(userId),
        getAccessibleBranchIds(userId),
      ])

      const data = await dashboardHrdService.getHrdSummary(companyIds, branchIds)
      sendSuccess(res, data)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_hrd_summary' })
    }
  }
}

export const dashboardHrdController = new DashboardHrdController()
