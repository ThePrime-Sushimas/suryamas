import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { balanceSheetService } from './balance-sheet.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { balanceSheetQuerySchema } from './balance-sheet.schema'
import { getAccessibleBranchIds, getAccessibleCompanyIds, requireBranchAccess } from '../../../utils/branch-access.util'

export class BalanceSheetController {
  async get(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const [companyIds, accessibleBranchIds] = await Promise.all([
        getAccessibleCompanyIds(userId),
        getAccessibleBranchIds(userId),
      ])

      const { query } = (req as ValidatedAuthRequest<typeof balanceSheetQuerySchema>).validated
      const { as_of_date, branch_ids, compare_as_of_date } = query

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

      const result = await balanceSheetService.getBalanceSheet({
        companyIds,
        asOfDate: as_of_date,
        branchFilterIds,
        groupByBranch,
        compareAsOfDate: compare_as_of_date,
      })

      sendSuccess(res, result, 'Balance sheet retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_balance_sheet' })
    }
  }
}

export const balanceSheetController = new BalanceSheetController()
