import { Request, Response } from 'express'
import { journalLinesService } from './journal-lines.service'
import { sendSuccess } from '../../../../utils/response.util'
import { handleError } from '../../../../utils/error-handler.util'
import { getPaginationParams } from '../../../../utils/pagination.util'
import { getAccessibleCompanyIds } from '../../../../utils/branch-access.util'

import type { JournalLineFilter, JournalLineSortParams } from './journal-lines.types'

export class JournalLinesController {

  /**
   * GET /api/v1/accounting/journals/:journalId/lines
   */
  async listByJournal(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const companyIds = await getAccessibleCompanyIds(userId)
      const journalId = req.params.journalId as string
      if (!journalId) throw new Error('journalId is required')

      const lines = await journalLinesService.getByJournalHeaderId(journalId, companyIds)
      sendSuccess(res, lines, 'Journal lines retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_journal_lines' })
    }
  }

  /**
   * GET /api/v1/accounting/journals/:journalId/lines/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const companyIds = await getAccessibleCompanyIds(userId)
      const id = req.params.id as string
      if (!id) throw new Error('line ID is required')

      const line = await journalLinesService.getById(id, companyIds)
      sendSuccess(res, line, 'Journal line retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_journal_line' })
    }
  }

  /**
   * GET /api/v1/accounting/journal-lines/by-account/:accountId
   */
  async getByAccount(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const companyIds = await getAccessibleCompanyIds(userId)
      const accountId = req.params.accountId as string
      if (!accountId) throw new Error('accountId is required')
      
      const query = req.query || {}

      const filter: JournalLineFilter = {
        journal_status: query.journal_status as 'POSTED_ONLY' | undefined,
        date_from: query.date_from as string,
        date_to: query.date_to as string,
        include_reversed: query.include_reversed === 'true',
        show_deleted: query.show_deleted === 'true'
      }

      const lines = await journalLinesService.getByAccountId(accountId, companyIds, filter)
      const balance = journalLinesService.calculateAccountBalance(lines)

      sendSuccess(res, {
        lines,
        summary: {
          total_debit: balance.total_debit,
          total_credit: balance.total_credit,
          balance: balance.balance,
          line_count: lines.length
        }
      }, 'Journal lines by account retrieved')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_lines_by_account' })
    }
  }

  /**
   * GET /api/v1/accounting/journal-lines
   */
  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.id ?? ''
      const companyIds = await getAccessibleCompanyIds(userId)
      const { page, limit, offset } = getPaginationParams(req.query)

      const sort: JournalLineSortParams = req.sort as Parameters<typeof journalLinesService.list>[2] || { 
        field: 'journal_date', 
        order: 'asc' 
      }
      
      const { company_id: _ignoredCompanyId, companyIds: _ignoredCompanyIds, ...queryFilters } =
        (req.filterParams ?? {}) as Record<string, unknown>
      const filter: JournalLineFilter = {
        include_reversed: false,
        show_deleted: false,
        ...queryFilters,
      }

      const result = await journalLinesService.list(companyIds, { page, limit, offset }, sort, filter)

      sendSuccess(res, result.data, 'Journal lines retrieved', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_all_lines' })
    }
  }
}

export const journalLinesController = new JournalLinesController()
