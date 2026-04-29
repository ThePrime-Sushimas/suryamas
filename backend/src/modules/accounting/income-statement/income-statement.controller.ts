import { Response } from 'express'
import { incomeStatementService } from './income-statement.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { incomeStatementQuerySchema } from './income-statement.schema'
import type { AuthenticatedRequest } from '../../../types/request.types'

export class IncomeStatementController {
  private getCompanyId(req: AuthenticatedRequest): string {
    const companyId = (req as any).context?.company_id
    if (!companyId) throw new Error('Branch context required - no company access')
    return companyId
  }

  async get(req: ValidatedAuthRequest<typeof incomeStatementQuerySchema>, res: Response) {
    try {
      const companyId = this.getCompanyId(req as any)
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
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const incomeStatementController = new IncomeStatementController()
