import { Request, Response } from 'express'
import { dashboardHrdService } from './dashboard-hrd.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'

class DashboardHrdController {
  async getSummary(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      if (!companyId) {
        sendSuccess(res, null, 'No branch context', 200)
        return
      }

      const data = await dashboardHrdService.getHrdSummary(companyId)
      sendSuccess(res, data)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_hrd_summary' })
    }
  }
}

export const dashboardHrdController = new DashboardHrdController()
