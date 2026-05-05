import type { Request, Response } from 'express'
import { dailyLedgerRepository } from './daily-ledger.repository'
import { DailyLedgerErrors } from './daily-ledger.errors'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'

class DailyLedgerController {
  async get(req: Request, res: Response) {
    try {
      const { date_from, date_to, branch_ids, account_types } = req.query as Record<string, string>
      const companyId = req.context?.company_id
      if (!companyId) { res.status(400).json({ success: false, message: 'Company context required' }); return }

      if (date_from > date_to) throw DailyLedgerErrors.INVALID_DATE_RANGE()

      const branchIds = branch_ids ? branch_ids.split(',').filter(Boolean) : undefined
      const typeFilter = account_types ? account_types.split(',').filter(Boolean) : undefined

      const [movements, openings] = await Promise.all([
        dailyLedgerRepository.getDailyMovements(companyId, date_from, date_to, branchIds),
        dailyLedgerRepository.getOpeningBalances(companyId, date_from, branchIds),
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
