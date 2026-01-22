import { Response } from 'express'
import { journalLinesService } from './journal-lines.service'
import { sendSuccess } from '../../../../utils/response.util'
import { handleError } from '../../../../utils/error-handler.util'
import { getPaginationParams } from '../../../../utils/pagination.util'

import { getParamString } from '../../../../utils/validation.util'
import type { AuthenticatedRequest, AuthenticatedQueryRequest } from '../../../../types/request.types'
import type { JournalLineFilter, JournalLineSortParams } from './journal-lines.types'

export class JournalLinesController {

  private getCompanyId(req: AuthenticatedRequest): string {
    const companyId = (req as any).context?.company_id
    if (!companyId) throw new Error('Branch context required - no company access')
    return companyId
  }

  /**
   * GET /api/v1/accounting/journals/:journalId/lines
   */
  async listByJournal(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const journalId = getParamString(req.params.journalId)
      if (!journalId) throw new Error('journalId is required')

      const lines = await journalLinesService.getByJournalHeaderId(journalId, companyId)
      sendSuccess(res, lines, 'Journal lines retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }

  /**
   * GET /api/v1/accounting/journals/:journalId/lines/:id
   */
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const id = getParamString(req.params.id)
      if (!id) throw new Error('line ID is required')

      const line = await journalLinesService.getById(id, companyId)
      sendSuccess(res, line, 'Journal line retrieved')
    } catch (error) {
      handleError(res, error)
    }
  }

  /**
   * GET /api/v1/accounting/journal-lines/by-account/:accountId
   */
  async getByAccount(req: AuthenticatedRequest, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const accountId = getParamString(req.params.accountId)
      if (!accountId) throw new Error('accountId is required')
      
      const query = req.query || {}

      const filter: JournalLineFilter = {
        company_id: companyId,
        journal_status: query.journal_status as any,
        date_from: query.date_from as string,
        date_to: query.date_to as string,
        include_reversed: query.include_reversed === 'true',
        show_deleted: query.show_deleted === 'true'
      }

      const lines = await journalLinesService.getByAccountId(accountId, companyId, filter)
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
    } catch (error) {
      handleError(res, error)
    }
  }

  /**
   * GET /api/v1/accounting/journal-lines
   */
  async list(req: AuthenticatedQueryRequest, res: Response) {
    try {
      const companyId = this.getCompanyId(req)
      const { page, limit, offset } = getPaginationParams(req.query)

      // Default sort: accounting-friendly
      const sort: JournalLineSortParams = (req.sort as any) || { 
        field: 'journal_date', 
        order: 'asc' 
      }
      
      // Default filter: only active, not reversed
      const filter: JournalLineFilter = { 
        company_id: companyId,
        include_reversed: false,
        show_deleted: false,
        ...(req.filterParams || {})
      }

      const result = await journalLinesService.list(companyId, { page, limit, offset }, sort, filter)

      sendSuccess(res, result.data, 'Journal lines retrieved', 200, result.pagination)
    } catch (error) {
      handleError(res, error)
    }
  }
}

export const journalLinesController = new JournalLinesController()
