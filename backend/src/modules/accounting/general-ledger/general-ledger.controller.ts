import type { Request, Response } from 'express'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { generalLedgerRepository } from './general-ledger.repository'
import { GeneralLedgerErrors } from './general-ledger.errors'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { generalLedgerQuerySchema } from './general-ledger.schema'
import { getAccessibleBranchIds, getAccessibleCompanyIds, requireBranchAccess } from '../../../utils/branch-access.util'

class GeneralLedgerController {
  async get(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const [companyIds, accessibleBranchIds] = await Promise.all([
        getAccessibleCompanyIds(userId),
        getAccessibleBranchIds(userId),
      ])

      const { query } = (req as ValidatedAuthRequest<typeof generalLedgerQuerySchema>).validated
      const { account_id, account_ids, date_from, date_to, branch_ids, search, page: pageStr, limit: limitStr } = query

      if (date_from > date_to) throw GeneralLedgerErrors.INVALID_DATE_RANGE()

      // Resolve account IDs — support single or multi
      const accountIdList: string[] = account_ids
        ? account_ids.split(',').map(s => s.trim()).filter(Boolean)
        : account_id
          ? [account_id]
          : []
      if (accountIdList.length === 0) throw GeneralLedgerErrors.ACCOUNT_REQUIRED()

      // Branch access check
      const branchFilterIds = branch_ids
        ? branch_ids.split(',').map(s => s.trim()).filter(Boolean)
        : accessibleBranchIds
      for (const id of branchFilterIds) requireBranchAccess(id, accessibleBranchIds)

      // Pagination
      const page = Math.max(1, parseInt(pageStr || '1', 10) || 1)
      const limit = Math.min(200, Math.max(1, parseInt(limitStr || '50', 10) || 50))
      const offset = (page - 1) * limit

      // Get account info for all selected accounts
      const accounts = await generalLedgerRepository.getAccountInfoMulti(accountIdList, companyIds)
      if (accounts.length === 0) throw GeneralLedgerErrors.ACCOUNT_NOT_FOUND()

      // Get opening balance, line count, period totals in parallel
      const [opening, total, periodTotals] = await Promise.all([
        generalLedgerRepository.getOpeningBalanceMulti(accountIdList, companyIds, date_from, branchFilterIds),
        generalLedgerRepository.getLineCountMulti(accountIdList, companyIds, date_from, date_to, branchFilterIds, search),
        generalLedgerRepository.getPeriodTotalsMulti(accountIdList, companyIds, date_from, date_to, branchFilterIds, search),
      ])

      // For multi-account, running balance is per-account using window PARTITION BY account_id
      const lines = await generalLedgerRepository.getLinesMulti(
        accountIdList, companyIds, date_from, date_to, branchFilterIds,
        accounts, opening, limit, offset, search
      )

      const totalPages = Math.ceil(total / limit)

      // Ending balance per account
      const endingBalances = accounts.map(acc => {
        const accOpening = opening.find(o => o.account_id === acc.account_id)
        const accTotals = periodTotals.find(t => t.account_id === acc.account_id)
        const openBal = accOpening?.opening_balance ?? 0
        const periodNet = acc.normal_balance === 'DEBIT'
          ? (accTotals?.total_debit ?? 0) - (accTotals?.total_credit ?? 0)
          : (accTotals?.total_credit ?? 0) - (accTotals?.total_debit ?? 0)
        return { account_id: acc.account_id, ending_balance: openBal + periodNet }
      })

      // Summary totals
      const summaryDebit = periodTotals.reduce((s, t) => s + t.total_debit, 0)
      const summaryCredit = periodTotals.reduce((s, t) => s + t.total_credit, 0)
      const summaryEnding = endingBalances.reduce((s, e) => s + e.ending_balance, 0)

      sendSuccess(res, {
        accounts,
        opening,
        lines,
        summary: {
          total_debit: summaryDebit,
          total_credit: summaryCredit,
          ending_balance: summaryEnding,
          line_count: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      })
    } catch (error) {
      await handleError(res, error, req, { action: 'general_ledger' })
    }
  }
}

export const generalLedgerController = new GeneralLedgerController()
