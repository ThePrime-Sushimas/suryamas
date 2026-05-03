import { journalHeadersRepository } from './journal-headers.repository'
import { chartOfAccountsRepository } from '../../chart-of-accounts/chart-of-accounts.repository'
import { fiscalPeriodsRepository } from '../../fiscal-periods/fiscal-periods.repository'
import { JournalHeader, JournalHeaderWithLines, CreateJournalDto, UpdateJournalDto, JournalFilter, SortParams } from './journal-headers.types'
import { JournalErrors } from '../shared/journal.errors'
import { validateJournalLines, validateJournalBalance, calculateTotals, generateJournalNumber, canTransition } from '../shared/journal.utils'
import { PaginatedResponse, createPaginatedResponse } from '../../../../utils/pagination.util'
import { logInfo, logError, logWarn } from '../../../../config/logger'
import { AuditService } from '../../../monitoring/monitoring.service'

export class JournalHeadersService {

  async list(companyId: string, pagination: { page: number; limit: number; offset: number }, sort?: SortParams, filter?: JournalFilter): Promise<PaginatedResponse<JournalHeader>> {
    const { data, total } = await journalHeadersRepository.findAll(companyId, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async listWithLines(companyId: string, pagination: { page: number; limit: number; offset: number }, sort?: SortParams, filter?: JournalFilter): Promise<PaginatedResponse<JournalHeaderWithLines>> {
    const { data, total } = await journalHeadersRepository.findAllWithLines(companyId, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async getById(id: string, companyId: string): Promise<JournalHeaderWithLines> {
    const journal = await journalHeadersRepository.findById(id)
    if (!journal) throw JournalErrors.NOT_FOUND(id)
    if (journal.company_id !== companyId) throw JournalErrors.NOT_FOUND(id)
    return journal
  }

  async create(data: CreateJournalDto & { company_id: string }, userId: string): Promise<JournalHeaderWithLines> {
    const lineErrors = validateJournalLines(data.lines)
    if (lineErrors.length > 0) throw JournalErrors.INVALID_LINES(lineErrors)
    if (!validateJournalBalance(data.lines)) throw JournalErrors.NOT_BALANCED()

    const accountIds = data.lines.map(line => line.account_id)
    const validationResults = await chartOfAccountsRepository.validateMany(accountIds, data.company_id)
    for (const line of data.lines) {
      const validation = validationResults.get(line.account_id)
      if (!validation || !validation.valid) throw JournalErrors.VALIDATION_ERROR('account', validation?.error || 'Account validation failed')
    }

    const totals = calculateTotals(data.lines)
    const fiscalPeriod = await fiscalPeriodsRepository.findByDate(data.company_id, data.journal_date)
    if (!fiscalPeriod) throw JournalErrors.VALIDATION_ERROR('journal_date', `Tidak ditemukan periode fiskal untuk tanggal ${data.journal_date}`)
    if (!fiscalPeriod.is_open) throw JournalErrors.PERIOD_CLOSED(fiscalPeriod.period)

    const period = fiscalPeriod.period
    const sequence = await journalHeadersRepository.getNextSequence(data.company_id, data.journal_type, period)
    const journalNumber = generateJournalNumber(data.journal_type, data.journal_date, sequence)

    const journal = await journalHeadersRepository.create({
      ...data, journal_number: journalNumber, sequence_number: sequence, period,
      total_debit: totals.total_debit, total_credit: totals.total_credit,
      currency: data.currency || 'IDR', exchange_rate: data.exchange_rate || 1, status: 'DRAFT'
    }, userId)

    await AuditService.log('CREATE', 'journal_header', journal.id, userId, undefined, {
      journal_number: journal.journal_number, journal_type: journal.journal_type,
      total_debit: journal.total_debit, total_credit: journal.total_credit
    })
    logInfo('Journal created', { journal_id: journal.id, journal_number: journal.journal_number, user_id: userId })
    return journal
  }

  async update(id: string, data: UpdateJournalDto, userId: string, companyId: string): Promise<JournalHeaderWithLines> {
    const existing = await this.getById(id, companyId)
    if (existing.status !== 'DRAFT') throw JournalErrors.CANNOT_EDIT_NON_DRAFT(existing.status)

    if (data.lines) {
      const lineErrors = validateJournalLines(data.lines)
      if (lineErrors.length > 0) throw JournalErrors.INVALID_LINES(lineErrors)
      if (!validateJournalBalance(data.lines)) throw JournalErrors.NOT_BALANCED()

      const accountIds = data.lines.map(line => line.account_id)
      const validationResults = await chartOfAccountsRepository.validateMany(accountIds, companyId)
      for (const line of data.lines) {
        const validation = validationResults.get(line.account_id)
        if (!validation || !validation.valid) throw JournalErrors.VALIDATION_ERROR('account', validation?.error || 'Account validation failed')
      }

      const totals = calculateTotals(data.lines)
      const { lines: _lines, ...headerData } = data
      await journalHeadersRepository.update(id, { ...headerData, total_debit: totals.total_debit, total_credit: totals.total_credit }, userId)

      const linesWithHeaderId = data.lines.map(line => ({
        ...line, journal_header_id: id, currency: existing.currency, exchange_rate: existing.exchange_rate,
        base_debit_amount: line.debit_amount * existing.exchange_rate, base_credit_amount: line.credit_amount * existing.exchange_rate,
        created_at: new Date().toISOString()
      }))
      await journalHeadersRepository.updateLines(id, linesWithHeaderId)
    } else {
      await journalHeadersRepository.update(id, data, userId)
    }

    await AuditService.log('UPDATE', 'journal_header', id, userId, { journal_number: existing.journal_number, status: existing.status }, { updates: data })
    return this.getById(id, companyId)
  }

  async delete(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    if (journal.status !== 'DRAFT' && journal.status !== 'REJECTED') throw JournalErrors.CANNOT_DELETE_POSTED()

    await journalHeadersRepository.clearJournalReferences(id)
    await journalHeadersRepository.delete(id, userId)
    await AuditService.log('DELETE', 'journal_header', id, userId, { journal_number: journal.journal_number, status: journal.status })
    logInfo('Journal deleted', { journal_id: id, user_id: userId })
  }

  async submit(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    if (!canTransition(journal.status, 'SUBMITTED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'SUBMITTED')
    await journalHeadersRepository.updateStatus(id, 'SUBMITTED', userId, { submitted_at: new Date().toISOString(), submitted_by: userId })
    await AuditService.log('SUBMIT', 'journal_header', id, userId, { status: journal.status }, { status: 'SUBMITTED' })
    logInfo('Journal submitted', { journal_id: id, user_id: userId })
  }

  async approve(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    if (!canTransition(journal.status, 'APPROVED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'APPROVED')
    await journalHeadersRepository.updateStatus(id, 'APPROVED', userId, { approved_at: new Date().toISOString(), approved_by: userId })
    await AuditService.log('APPROVE', 'journal_header', id, userId, { status: journal.status }, { status: 'APPROVED' })
    logInfo('Journal approved', { journal_id: id, user_id: userId })
  }

  async reject(id: string, reason: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    if (!canTransition(journal.status, 'REJECTED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'REJECTED')
    await journalHeadersRepository.update(id, { status: 'REJECTED', rejected_at: new Date().toISOString(), rejected_by: userId, rejection_reason: reason }, userId)
    await journalHeadersRepository.clearJournalReferences(id)
    await AuditService.log('REJECT', 'journal_header', id, userId, { status: journal.status }, { status: 'REJECTED', rejection_reason: reason })
    logInfo('Journal rejected', { journal_id: id, user_id: userId, reason })
  }

  async post(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    if (!canTransition(journal.status, 'POSTED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'POSTED')

    const lineErrors = validateJournalLines(journal.lines)
    if (lineErrors.length > 0) throw JournalErrors.INVALID_LINES(lineErrors)
    if (!validateJournalBalance(journal.lines)) throw JournalErrors.NOT_BALANCED()

    const fiscalPeriod = await fiscalPeriodsRepository.findByDate(companyId, journal.journal_date)
    if (!fiscalPeriod || !fiscalPeriod.is_open) throw JournalErrors.PERIOD_CLOSED(journal.period)

    await journalHeadersRepository.updateStatus(id, 'POSTED', userId, { posted_at: new Date().toISOString(), posted_by: userId })
    await AuditService.log('POST', 'journal_header', id, userId, { status: journal.status }, { status: 'POSTED' })
    logInfo('Journal posted', { journal_id: id, user_id: userId })

    if (journal.source_module === 'POS_AGGREGATES') {
      this.updatePosImportStatusIfFullyPosted(id).catch(err => logError('Failed to update pos_import status', { journal_id: id, error: err }))
    }
  }

  private async updatePosImportStatusIfFullyPosted(journalId: string): Promise<void> {
    try {
      const posImportId = await journalHeadersRepository.updatePosAggregateStatus(journalId)
      if (!posImportId) { logWarn('No aggregated transactions updated', { journal_id: journalId }); return }

      const remaining = await journalHeadersRepository.countUnjournaledByImport(posImportId)
      if (remaining === 0) {
        await journalHeadersRepository.markPosImportPosted(posImportId)
        logInfo('POS import fully posted', { pos_import_id: posImportId })
      }
    } catch (error) {
      logError('updatePosImportStatusIfFullyPosted failed', { journal_id: journalId, error })
    }
  }

  async reverse(id: string, reason: string, userId: string, companyId: string): Promise<JournalHeaderWithLines> {
    const original = await this.getById(id, companyId)
    if (original.status !== 'POSTED') throw JournalErrors.REVERSE_NON_POSTED(original.status)
    if (original.is_reversed) throw JournalErrors.ALREADY_REVERSED()
    if (original.reversal_of_journal_id) throw JournalErrors.CANNOT_REVERSE_REVERSAL()

    const reversalLines = original.lines.map(line => ({
      line_number: line.line_number, account_id: line.account_id, description: line.description,
      debit_amount: line.credit_amount, credit_amount: line.debit_amount
    }))

    const reversal = await this.create({
      company_id: original.company_id, branch_id: original.branch_id,
      journal_date: new Date().toISOString().split('T')[0], journal_type: original.journal_type,
      description: `REVERSAL OF ${original.journal_number}`, currency: original.currency, exchange_rate: original.exchange_rate,
      reference_type: 'journal_reversal', reference_id: id, reference_number: original.journal_number,
      reversal_of_journal_id: id, lines: reversalLines
    }, userId)

    await this.submit(reversal.id, userId, companyId)
    await this.approve(reversal.id, userId, companyId)
    await this.post(reversal.id, userId, companyId)
    await journalHeadersRepository.markReversed(id, reversal.id, reason)

    await AuditService.log('REVERSE', 'journal_header', id, userId, { status: original.status, is_reversed: false }, { status: 'REVERSED', reversal_id: reversal.id, reason })
    logInfo('Journal reversed', { original_id: id, reversal_id: reversal.id, user_id: userId, reason })
    return reversal
  }

  async restore(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await journalHeadersRepository.findById(id, true)
    if (!journal) throw JournalErrors.NOT_FOUND(id)
    if (journal.company_id !== companyId) throw JournalErrors.NOT_FOUND(id)
    if (!journal.deleted_at) throw new Error('Journal is not deleted')

    await journalHeadersRepository.restore(id, userId)
    await AuditService.log('RESTORE', 'journal_header', id, userId, { deleted_at: journal.deleted_at }, { deleted_at: null })
    logInfo('Journal restored', { journal_id: id, user_id: userId })
  }

  async forceDelete(id: string, userId: string, companyId: string): Promise<void> {
    const journal = await this.getById(id, companyId)
    if (journal.source_module === 'FISCAL_CLOSING') {
      throw JournalErrors.CANNOT_DELETE_POSTED()
    }
    await journalHeadersRepository.clearJournalReferences(id)
    await journalHeadersRepository.delete(id, userId)
    await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, { journal_number: journal.journal_number, status: journal.status })
    logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
  }

  async getCompleteness(id: string, companyId: string): Promise<{
    is_complete: boolean; total_channels: number; reconciled_channels: number;
    unreconciled: Array<{ payment_method_id: number; payment_method_name: string; nett_amount: number; status: string }>
  }> {
    const journal = await this.getById(id, companyId)
    if (journal.source_module !== 'POS_AGGREGATES' || !journal.branch_id) {
      return { is_complete: true, total_channels: 0, reconciled_channels: 0, unreconciled: [] }
    }

    const all = await journalHeadersRepository.getAggregatedForCompleteness(journal.branch_id, journal.journal_date)
    const unreconciled = all.filter(t => !t.is_reconciled)
    const pmIds = [...new Set(unreconciled.map(t => t.payment_method_id).filter(Boolean))]
    const pmNames = await journalHeadersRepository.getPaymentMethodNames(pmIds)

    return {
      is_complete: unreconciled.length === 0,
      total_channels: all.length,
      reconciled_channels: all.length - unreconciled.length,
      unreconciled: unreconciled.map(t => ({
        payment_method_id: t.payment_method_id,
        payment_method_name: pmNames[t.payment_method_id] || `PM ${t.payment_method_id}`,
        nett_amount: Number(t.nett_amount),
        status: t.status,
      })),
    }
  }
  async getStatusCounts(companyId: string, dateFrom?: string, dateTo?: string): Promise<Record<string, number>> {
    return journalHeadersRepository.getStatusCounts(companyId, dateFrom, dateTo)
  }
}

export const journalHeadersService = new JournalHeadersService()
