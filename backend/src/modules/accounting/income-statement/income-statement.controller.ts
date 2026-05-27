import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { incomeStatementService } from './income-statement.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { incomeStatementQuerySchema } from './income-statement.schema'
import { getAccessibleBranchIds, getAccessibleCompanyIds, requireBranchAccess } from '../../../utils/branch-access.util'

export class IncomeStatementController {
  async get(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const [companyIds, accessibleBranchIds] = await Promise.all([
        getAccessibleCompanyIds(userId),
        getAccessibleBranchIds(userId),
      ])

      const { query } = (req as ValidatedAuthRequest<typeof incomeStatementQuerySchema>).validated
      const { date_from, date_to, branch_ids, compare_date_from, compare_date_to } = query

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

      const result = await incomeStatementService.getIncomeStatement({
        companyIds,
        dateFrom: date_from,
        dateTo: date_to,
        branchFilterIds,
        groupByBranch,
        compareDateFrom: compare_date_from,
        compareDateTo: compare_date_to,
      })

      sendSuccess(res, result, 'Income statement retrieved', 200)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_income_statement' })
    }
  }
}

export const incomeStatementController = new IncomeStatementController()
