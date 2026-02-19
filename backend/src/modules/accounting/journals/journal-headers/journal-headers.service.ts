import { journalHeadersRepository } from './journal-headers.repository'
import { chartOfAccountsRepository } from '../../chart-of-accounts/chart-of-accounts.repository'
import { fiscalPeriodsRepository } from '../../fiscal-periods/fiscal-periods.repository'
import { JournalHeader, JournalHeaderWithLines, CreateJournalDto, UpdateJournalDto, JournalFilter, SortParams } from './journal-headers.types'
import { JournalStatus } from '../shared/journal.types'
import { JournalErrors } from '../shared/journal.errors'
import { validateJournalLines, validateJournalBalance, calculateTotals, generateJournalNumber, getPeriodFromDate, canTransition } from '../shared/journal.utils'
import { PaginatedResponse, createPaginatedResponse } from '../../../../utils/pagination.util'
import { logInfo, logError } from '../../../../config/logger'
import { AuditService } from '../../../monitoring/monitoring.service'

export class JournalHeadersService {
  
  async list(
    companyId: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: SortParams,
    filter?: JournalFilter
  ): Promise<PaginatedResponse<JournalHeader>> {
    const { data, total } = await journalHeadersRepository.findAll(
      companyId,
      pagination,
      sort,
      filter
    )
    
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async listWithLines(
    companyId: string,
    pagination: { page: number; limit: number; offset: number },
    sort?: SortParams,
    filter?: JournalFilter
  ): Promise<PaginatedResponse<JournalHeaderWithLines>> {
    const { data, total } = await journalHeadersRepository.findAllWithLines(
      companyId,
      pagination,
      sort,
      filter
    )
    
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async getById(id: string, companyId: string): Promise<JournalHeaderWithLines> {
    const journal = await journalHeadersRepository.findById(id)
    
    if (!journal) {
      throw JournalErrors.NOT_FOUND(id)
    }
    
    if (journal.company_id !== companyId) {
      throw JournalErrors.NOT_FOUND(id)
    }
    
    return journal
  }

  async create(data: CreateJournalDto & { company_id: string }, userId: string): Promise<JournalHeaderWithLines> {
    // Validate lines structure
    const lineErrors = validateJournalLines(data.lines)
    if (lineErrors.length > 0) {
      throw JournalErrors.INVALID_LINES(lineErrors)
    }

    // Validate balance separately
    if (!validateJournalBalance(data.lines)) {
      throw JournalErrors.NOT_BALANCED()
    }

    // Validate accounts - BULK QUERY (optimized from N+1)
    const accountIds = data.lines.map(line => line.account_id)
    const validationResults = await chartOfAccountsRepository.validateMany(accountIds, data.company_id)
    
    for (const line of data.lines) {
      const validation = validationResults.get(line.account_id)
      if (!validation || !validation.valid) {
        throw JournalErrors.VALIDATION_ERROR('account', validation?.error || 'Account validation failed')
      }
    }

    // Calculate totals
    const totals = calculateTotals(data.lines)
    
    // Get next sequence and generate journal number
    const period = getPeriodFromDate(data.journal_date)
    const sequence = await journalHeadersRepository.getNextSequence(
      data.company_id,
      data.journal_type,
      period
    )
    const journalNumber = generateJournalNumber(data.journal_type, data.journal_date, sequence)

    // Create journal
    const journal = await journalHeadersRepository.create({
      ...data,
      journal_number: journalNumber,
      sequence_number: sequence,
      period,
      total_debit: totals.total_debit,
      total_credit: totals.total_credit,
      currency: data.currency || 'IDR',
      exchange_rate: data.exchange_rate || 1,
      status: 'DRAFT'
    }, userId)

    await AuditService.log('CREATE', 'journal_header', journal.id, userId, undefined, {
      journal_number: journal.journal_number,
      journal_type: journal.journal_type,
      total_debit: journal.total_debit,
      total_credit: journal.total_credit
    })

    logInfo('Journal created', { 
      journal_id: journal.id, 
      journal_number: journal.journal_number,
      user_id: userId
    })

    return journal
  }

  async update(id: string, data: UpdateJournalDto, userId: string, companyId: string): Promise<JournalHeaderWithLines> {
    const existing = await this.getById(id, companyId)
    
    if (existing.status !== 'DRAFT') {
      throw JournalErrors.CANNOT_EDIT_NON_DRAFT(existing.status)
    }

    if (data.lines) {
      // Validate lines structure
      const lineErrors = validateJournalLines(data.lines)
      if (lineErrors.length > 0) {
        throw JournalErrors.INVALID_LINES(lineErrors)
      }

      // Validate balance separately
      if (!validateJournalBalance(data.lines)) {
        throw JournalErrors.NOT_BALANCED()
      }

      // Validate accounts - BULK QUERY (optimized from N+1)
      const accountIds = data.lines.map(line => line.account_id)
      const validationResults = await chartOfAccountsRepository.validateMany(accountIds, companyId)
      
      for (const line of data.lines) {
        const validation = validationResults.get(line.account_id)
        if (!validation || !validation.valid) {
          throw JournalErrors.VALIDATION_ERROR('account', validation?.error || 'Account validation failed')
        }
      }

      const totals = calculateTotals(data.lines)
      
      // Update header with new totals
      await journalHeadersRepository.update(id, {
        ...data,
        total_debit: totals.total_debit,
        total_credit: totals.total_credit
      }, userId)

      // Update lines (delete old, insert new)
      const linesWithHeaderId = data.lines.map(line => ({
        ...line,
        journal_header_id: id,
        currency: existing.currency,
        exchange_rate: existing.exchange_rate,
        base_debit_amount: line.debit_amount * existing.exchange_rate,
        base_credit_amount: line.credit_amount * existing.exchange_rate,
        created_at: new Date().toISOString()
      }))

      await journalHeadersRepository.updateLines(id, linesWithHeaderId)
    } else {
      await journalHeadersRepository.update(id, data, userId)
    }

    await AuditService.log('UPDATE', 'journal_header', id, userId, {
      journal_number: existing.journal_number,
      status: existing.status
    }, {
      journal_number: existing.journal_number,
      status: existing.status,
      updates: data
    })

    return this.getById(id, companyId)
  }

  async delete(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    
    if (journal.status !== 'DRAFT' && journal.status !== 'REJECTED') {
      throw JournalErrors.CANNOT_DELETE_POSTED()
    }

    await journalHeadersRepository.delete(id, userId)
    
    await AuditService.log('DELETE', 'journal_header', id, userId, {
      journal_number: journal.journal_number,
      status: journal.status
    })

    logInfo('Journal deleted', { journal_id: id, user_id: userId })
  }

  async submit(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    
    if (!canTransition(journal.status, 'SUBMITTED')) {
      throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'SUBMITTED')
    }

    await journalHeadersRepository.updateStatus(id, 'SUBMITTED', userId, {
      submitted_at: new Date().toISOString(),
      submitted_by: userId
    })

    await AuditService.log('SUBMIT', 'journal_header', id, userId, {
      journal_number: journal.journal_number,
      status: journal.status
    }, {
      journal_number: journal.journal_number,
      status: 'SUBMITTED'
    })

    logInfo('Journal submitted', { journal_id: id, user_id: userId })
  }

  async approve(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    
    if (!canTransition(journal.status, 'APPROVED')) {
      throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'APPROVED')
    }

    await journalHeadersRepository.updateStatus(id, 'APPROVED', userId, {
      approved_at: new Date().toISOString(),
      approved_by: userId
    })

    await AuditService.log('APPROVE', 'journal_header', id, userId, {
      journal_number: journal.journal_number,
      status: journal.status
    }, {
      journal_number: journal.journal_number,
      status: 'APPROVED'
    })

    logInfo('Journal approved', { journal_id: id, user_id: userId })
  }

  async reject(id: string, reason: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    
    if (!canTransition(journal.status, 'REJECTED')) {
      throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'REJECTED')
    }

    await journalHeadersRepository.update(id, {
      status: 'REJECTED',
      rejected_at: new Date().toISOString(),
      rejected_by: userId,
      rejection_reason: reason
    }, userId)

    await AuditService.log('REJECT', 'journal_header', id, userId, {
      journal_number: journal.journal_number,
      status: journal.status
    }, {
      journal_number: journal.journal_number,
      status: 'REJECTED',
      rejection_reason: reason
    })

    logInfo('Journal rejected', { journal_id: id, user_id: userId, reason })
  }

  async post(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    
    if (!canTransition(journal.status, 'POSTED')) {
      throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'POSTED')
    }

    // Validate lines structure from DB
    const lineErrors = validateJournalLines(journal.lines)
    if (lineErrors.length > 0) {
      throw JournalErrors.INVALID_LINES(lineErrors)
    }

    // Validate balance from DB (critical: always fetch from DB, never trust client)
    if (!validateJournalBalance(journal.lines)) {
      throw JournalErrors.NOT_BALANCED()
    }

    // Check period not closed
    const period = await fiscalPeriodsRepository.findByCompanyAndPeriod(companyId, journal.period)
    if (!period || !period.is_open) {
      throw JournalErrors.PERIOD_CLOSED(journal.period)
    }

    // TODO: Post to general ledger
    // await generalLedgerService.postFromJournal(journal)

    await journalHeadersRepository.updateStatus(id, 'POSTED', userId, {
      posted_at: new Date().toISOString(),
      posted_by: userId
    })

    await AuditService.log('POST', 'journal_header', id, userId, {
      journal_number: journal.journal_number,
      status: journal.status
    }, {
      journal_number: journal.journal_number,
      status: 'POSTED'
    })

    logInfo('Journal posted', { journal_id: id, user_id: userId })
  }

  async reverse(id: string, reason: string, userId: string, companyId: string): Promise<JournalHeaderWithLines> {
    const original = await this.getById(id, companyId)
    
    if (original.status !== 'POSTED') {
      throw JournalErrors.INVALID_STATUS_TRANSITION(original.status, 'REVERSED')
    }
    
    if (original.is_reversed) {
      throw JournalErrors.ALREADY_REVERSED()
    }

    // Create reversal journal with swapped debit/credit
    // NOTE: Uses original.journal_type (accounting standard)
    // Alternative: Some ERPs use separate 'ADJUSTMENT' type for reversals
    const reversalLines = original.lines.map(line => ({
      line_number: line.line_number,
      account_id: line.account_id,
      description: line.description,
      debit_amount: line.credit_amount,
      credit_amount: line.debit_amount
    }))

    const reversal = await this.create({
      company_id: original.company_id,
      branch_id: original.branch_id,
      journal_date: new Date().toISOString().split('T')[0],
      journal_type: original.journal_type,
      description: `REVERSAL: ${original.description}`,
      currency: original.currency,
      exchange_rate: original.exchange_rate,
      reference_type: 'journal_reversal',
      reference_id: id,
      reference_number: original.journal_number,
      lines: reversalLines
    }, userId)

    // Auto-approve and post reversal
    await this.submit(reversal.id, userId, companyId)
    await this.approve(reversal.id, userId, companyId)
    await this.post(reversal.id, userId, companyId)

    // Mark original as reversed
    await journalHeadersRepository.markReversed(id, reversal.id, reason)

    await AuditService.log('REVERSE', 'journal_header', id, userId, {
      journal_number: original.journal_number,
      status: original.status,
      is_reversed: false
    }, {
      journal_number: original.journal_number,
      status: 'REVERSED',
      reversal_id: reversal.id,
      reversal_journal_number: reversal.journal_number,
      reason
    })

    logInfo('Journal reversed', { 
      original_id: id, 
      reversal_id: reversal.id, 
      user_id: userId,
      reason
    })

    return reversal
  }

  async restore(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await journalHeadersRepository.findById(id, true)
    
    if (!journal) {
      throw JournalErrors.NOT_FOUND(id)
    }
    
    if (journal.company_id !== companyId) {
      throw JournalErrors.NOT_FOUND(id)
    }
    
    if (!journal.deleted_at) {
      throw new Error('Journal is not deleted')
    }

    await journalHeadersRepository.restore(id, userId)
    
    await AuditService.log('RESTORE', 'journal_header', id, userId, {
      journal_number: journal.journal_number,
      deleted_at: journal.deleted_at
    }, {
      journal_number: journal.journal_number,
      deleted_at: null
    })

    logInfo('Journal restored', { journal_id: id, user_id: userId })
  }
}

export const journalHeadersService = new JournalHeadersService()
