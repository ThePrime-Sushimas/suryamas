import type { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { dailyLedgerRepository } from './daily-ledger.repository'
import { DailyLedgerErrors } from './daily-ledger.errors'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { dailyLedgerQuerySchema } from './daily-ledger.schema'
import { getAccessibleBranchIds, getAccessibleCompanyIds, requireBranchAccess } from '../../../utils/branch-access.util'

class DailyLedgerController {
  async get(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const [companyIds, accessibleBranchIds] = await Promise.all([
        getAccessibleCompanyIds(userId),
        getAccessibleBranchIds(userId),
      ])

      const { query } = (req as ValidatedAuthRequest<typeof dailyLedgerQuerySchema>).validated
      const { date_from, date_to, branch_ids, account_types } = query

      if (date_from > date_to) throw DailyLedgerErrors.INVALID_DATE_RANGE()

      const branchFilterIds = branch_ids
        ? branch_ids.split(',').map(s => s.trim()).filter(Boolean)
        : accessibleBranchIds
      for (const id of branchFilterIds) requireBranchAccess(id, accessibleBranchIds)

      const typeFilter = account_types ? account_types.split(',').map(s => s.trim()).filter(Boolean) : undefined

      const [movements, openings] = await Promise.all([
        dailyLedgerRepository.getDailyMovements(companyIds, date_from, date_to, branchFilterIds),
        dailyLedgerRepository.getOpeningBalances(companyIds, date_from, branchFilterIds),
      ])

      // Filter by account type if specified
      const filteredMovements = typeFilter
        ? movements.filter(m => typeFilter.includes(m.account_type))
        : movements
      const filteredOpenings = typeFilter
        ? openings.filter(o => typeFilter.includes(o.account_type))
        : openings

      sendSuccess(res, { movements: filteredMovements, openings: filteredOpenings })
    } catch (error) {
      await handleError(res, error, req, { action: 'daily_ledger' })
    }
  }
}

export const dailyLedgerController = new DailyLedgerController()
