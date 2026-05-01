import { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { incomeStatementService } from './income-statement.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { incomeStatementQuerySchema } from './income-statement.schema'

export class IncomeStatementController {
  async get(req: Request, res: Response) {
    try {
      const companyId = req.context?.company_id
      if (!companyId) throw new Error('Branch context required - no company access')

      const { query } = (req as ValidatedAuthRequest<typeof incomeStatementQuerySchema>).validated
      const { date_from, date_to, branch_ids, compare_date_from, compare_date_to } = query

      const branchIds = branch_ids
        ? branch_ids.split(',').map(s => s.trim()).filter(Boolean)
        : undefined

      const result = await incomeStatementService.getIncomeStatement({
        companyId,
        dateFrom: date_from,
        dateTo: date_to,
        branchIds,
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
