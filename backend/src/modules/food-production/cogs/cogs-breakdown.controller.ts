import { Request, Response } from 'express'
import { handleError } from '../../../utils/error-handler.util'
import { cogsBreakdownService } from './cogs-breakdown.service'
import { getAccessibleCompanyIds } from '../../../utils/branch-access.util'

class CogsBreakdownController {
  async getBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const { period_start, period_end, branch_id } = req.query as Record<string, string>
      if (!period_start || !period_end) { res.status(400).json({ success: false, message: 'period_start and period_end are required' }); return }

      const result = await cogsBreakdownService.getFullBreakdown(companyIds, period_start, period_end, branch_id || null)
      res.json({ success: true, data: result })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_cogs_breakdown' })
    }
  }

  async getMenus(req: Request, res: Response): Promise<void> {
    try {
      const companyIds = await getAccessibleCompanyIds(req.user?.id ?? '')
      const { period_start, period_end, branch_id, category_code, group_id } = req.query as Record<string, string>
      if (!period_start || !period_end) { res.status(400).json({ success: false, message: 'period_start and period_end are required' }); return }

      const menus = await cogsBreakdownService.getMenusForGroup(
        companyIds, period_start, period_end, branch_id || null, category_code || null, group_id || null,
      )
      res.json({ success: true, data: menus })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_cogs_breakdown_menus' })
    }
  }
}

export const cogsBreakdownController = new CogsBreakdownController()
