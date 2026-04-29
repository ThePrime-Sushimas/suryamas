import { Response } from 'express'
import { balanceSheetService } from './balance-sheet.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { balanceSheetQuerySchema } from './balance-sheet.schema'
import type { AuthenticatedRequest } from '../../../types/request.types'

export class BalanceSheetController {
  private getCompanyId(req: AuthenticatedRequest): string {
    const companyId = (req as any).context?.company_id
    if (!companyId) throw new Error('Branch context required - no company access')
    return companyId
  }

  async get(req: ValidatedAuthRequest<typeof balanceSheetQuerySchema>, res: Response) {
    try {
      const companyId = this.getCompanyId(req as any)
      const { as_of_date, branch_ids, compare_as_of_date } = req.validated.query

      const branchIds = branch_ids
        ? branch_ids.split(',').map(s => s.trim()).filter(Boolean)
        : undefined

      const result = await balanceSheetService.getBalanceSheet({
        companyId,
        asOfDate: as_of_date,
        branchIds,
        compareAsOfDate: compare_as_of_date,
      })

      sendSuccess(res, result, 'Balance sheet retrieved', 200)
    } catch (error) {
      handleError(res, error, req)
    }
  }
}

export const balanceSheetController = new BalanceSheetController()
