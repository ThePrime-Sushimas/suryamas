import { journalLinesRepository } from './journal-lines.repository'
import { JournalLineWithDetails, JournalLineFilter, JournalLineSortParams } from './journal-lines.types'
import { PaginatedResponse, createPaginatedResponse } from '../../../../utils/pagination.util'
import { logInfo } from '../../../../config/logger'

export class JournalLinesService {
  
  /**
   * List journal lines with pagination and filtering
   * Default behavior: hide deleted and reversed journals
   * Default sort: journal_date ASC, journal_number ASC, line_number ASC
   */
  async list(
    companyId: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: JournalLineSortParams,
    filter?: JournalLineFilter
  ): Promise<PaginatedResponse<JournalLineWithDetails>> {
    
    // Enforce company_id in filter
    const enhancedFilter: JournalLineFilter = {
      ...filter,
      company_id: companyId
    }
    
    const { data, total } = await journalLinesRepository.findAll(
      companyId,
      pagination,
      sort,
      enhancedFilter
    )
    
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  /**
   * Get single journal line by ID
   * Validates company access
   */
  async getById(id: string, companyId: string): Promise<JournalLineWithDetails> {
    const line = await journalLinesRepository.findById(id, companyId)
    
    if (!line) {
      throw new Error('Journal line not found')
    }
    
    return line
  }

  /**
   * Get all lines for a specific journal header
   * Used for journal detail view
   */
  async getByJournalHeaderId(
    journalHeaderId: string,
    companyId: string
  ): Promise<JournalLineWithDetails[]> {
    const lines = await journalLinesRepository.findByJournalHeaderId(journalHeaderId, companyId)
    
    return lines
  }

  /**
   * Get lines by account ID
   * Primary use: GL reporting, trial balance
   * Default: POSTED only, exclude reversed
   */
  async getByAccountId(
    accountId: string,
    companyId: string,
    filter?: JournalLineFilter
  ): Promise<JournalLineWithDetails[]> {
    
    // For reporting, default to POSTED_ONLY if not specified
    const reportingFilter: JournalLineFilter = {
      ...filter,
      company_id: companyId,
      journal_status: filter?.journal_status || 'POSTED_ONLY',
      include_reversed: filter?.include_reversed ?? false,
      show_deleted: filter?.show_deleted ?? false
    }
    
    const lines = await journalLinesRepository.findByAccountId(
      accountId,
      companyId,
      reportingFilter
    )
    
    logInfo('Journal lines retrieved by account', {
      account_id: accountId,
      company_id: companyId,
      count: lines.length,
      filter: reportingFilter
    })
    
    return lines
  }

  /**
   * Calculate account balance from lines
   * Used for GL and trial balance
   */
  calculateAccountBalance(lines: JournalLineWithDetails[]): {
    total_debit: number
    total_credit: number
    balance: number
  } {
    const total_debit = lines.reduce((sum, line) => sum + line.debit_amount, 0)
    const total_credit = lines.reduce((sum, line) => sum + line.credit_amount, 0)
    const balance = total_debit - total_credit
    
    return { total_debit, total_credit, balance }
  }
}

export const journalLinesService = new JournalLinesService()
