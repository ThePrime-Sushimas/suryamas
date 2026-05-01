import { Request, Response } from 'express'
import { incomeStatementService } from './income-statement.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { incomeStatementQuerySchema } from './income-statement.schema'

export class IncomeStatementController {
  private getCompanyId(req: Request): string {
    const companyId = req.context?.company_id
    if (!companyId) throw new Error('Branch context required - no company access')
    return companyId
  }

  async get(req: ValidatedAuthRequest<typeof incomeStatementQuerySchema>, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const { date_from, date_to, branch_ids, compare_date_from, compare_date_to } = req.validated.query

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
      await handleError(res, error, req, { action: 'get_income_statement', company_id: req.context?.company_id })
    }
  }
}

export const incomeStatementController = new IncomeStatementController()
