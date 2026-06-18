import { journalHeadersRepository } from './journal-headers.repository'
import { chartOfAccountsRepository } from '../../chart-of-accounts/chart-of-accounts.repository'
import { fiscalPeriodsRepository } from '../../fiscal-periods/fiscal-periods.repository'
import { JournalHeader, JournalHeaderWithLines, CreateJournalDto, UpdateJournalDto, JournalFilter, SortParams } from './journal-headers.types'
import { JournalErrors } from '../shared/journal.errors'
import { validateJournalLines, validateJournalBalance, calculateTotals, generateJournalNumber, canTransition } from '../shared/journal.utils'
import { PaginatedResponse, createPaginatedResponse } from '../../../../utils/pagination.util'
import { logInfo, logError, logWarn } from '../../../../config/logger'
import { AuditService } from '../../../monitoring/monitoring.service'
import { marketplacePoRepository } from '../../../marketplace-po/marketplace-po.repository'
import { apPaymentsRepository } from '../../../ap-payments/ap-payments.repository'
import {
  generalInvoiceRepository,
  generalPaymentRepository,
  amortizationRepository,
} from '../../../general-invoices/general-invoices.repository'
import { notificationDispatcher } from '../../../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../../../notifications/notification-events'
import { getAccessScope, isBranchAccessible } from '../../../../utils/branch-access.util'

export class JournalHeadersService {

  private assertJournalAccess(
    journal: { branch_id?: string | null; company_id: string },
    branchIds: string[],
    companyIds: string[],
    id: string,
  ): void {
    if (journal.branch_id) {
      if (!isBranchAccessible(journal.branch_id, branchIds)) throw JournalErrors.NOT_FOUND(id)
    } else if (!companyIds.includes(journal.company_id)) {
      throw JournalErrors.NOT_FOUND(id)
    }
  }

  async list(branchIds: string[], companyIds: string[], pagination: { page: number; limit: number; offset: number }, sort?: SortParams, filter?: JournalFilter): Promise<PaginatedResponse<JournalHeader>> {
    const { data, total } = await journalHeadersRepository.findAll(branchIds, companyIds, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  async listWithLines(branchIds: string[], companyIds: string[], pagination: { page: number; limit: number; offset: number }, sort?: SortParams, filter?: JournalFilter): Promise<PaginatedResponse<JournalHeaderWithLines>> {
    const { data, total } = await journalHeadersRepository.findAllWithLines(branchIds, companyIds, pagination, sort, filter)
    return createPaginatedResponse(data, total, pagination.page, pagination.limit)
  }

  /** API: resolve by accessible branches (cross-company). */
  async getByIdForUser(id: string, branchIds: string[], companyIds: string[]): Promise<JournalHeaderWithLines> {
    const journal = await journalHeadersRepository.findById(id)
    if (!journal) throw JournalErrors.NOT_FOUND(id)
    this.assertJournalAccess(journal, branchIds, companyIds, id)
    return journal
  }

  /** Internal: company_id on the journal must match (callers pass company from the record). */
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

  async update(id: string, data: UpdateJournalDto, userId: string, branchIds: string[], companyIds: string[]): Promise<JournalHeaderWithLines> {
    const existing = await this.getByIdForUser(id, branchIds, companyIds)
    const companyId = existing.company_id
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
    return this.getByIdForUser(id, branchIds, companyIds)
  }

  async delete(id: string, userId: string, branchIds: string[], companyIds: string[]): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds)
    const companyId = journal.company_id
    if (journal.status !== 'DRAFT' && journal.status !== 'REJECTED') throw JournalErrors.CANNOT_DELETE_POSTED()

    await journalHeadersRepository.clearJournalReferences(id)
    await journalHeadersRepository.delete(id, userId)
    await AuditService.log('DELETE', 'journal_header', id, userId, { journal_number: journal.journal_number, status: journal.status })
    logInfo('Journal deleted', { journal_id: id, user_id: userId })
  }

  async submit(id: string, userId: string, branchIds: string[], companyIds: string[]): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds)
    const companyId = journal.company_id
    if (!canTransition(journal.status, 'SUBMITTED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'SUBMITTED')
    await journalHeadersRepository.updateStatus(id, 'SUBMITTED', userId, { submitted_at: new Date().toISOString(), submitted_by: userId })
    await AuditService.log('SUBMIT', 'journal_header', id, userId, { status: journal.status }, { status: 'SUBMITTED' })
    logInfo('Journal submitted', { journal_id: id, user_id: userId })

    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.JOURNAL_SUBMITTED,
      companyId,
      {
        entityId: id,
        variables: { journal_number: journal.journal_number },
        excludeUserIds: [userId],
      }
    )
  }

  async approve(id: string, userId: string, branchIds: string[], companyIds: string[]): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds)
    const companyId = journal.company_id
    if (!canTransition(journal.status, 'APPROVED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'APPROVED')
    await journalHeadersRepository.updateStatus(id, 'APPROVED', userId, { approved_at: new Date().toISOString(), approved_by: userId })
    await AuditService.log('APPROVE', 'journal_header', id, userId, { status: journal.status }, { status: 'APPROVED' })
    logInfo('Journal approved', { journal_id: id, user_id: userId })

    const submitterId = journal.submitted_by ?? journal.created_by
    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.JOURNAL_APPROVED,
      companyId,
      {
        entityId: id,
        variables: { journal_number: journal.journal_number },
        additionalRecipientIds:
          submitterId && submitterId !== userId ? [submitterId] : [],
        excludeUserIds: [userId],
      }
    )
  }

  async reject(id: string, reason: string, userId: string, branchIds: string[], companyIds: string[]): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds)
    const companyId = journal.company_id
    if (!canTransition(journal.status, 'REJECTED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'REJECTED')
    await journalHeadersRepository.update(id, { status: 'REJECTED', rejected_at: new Date().toISOString(), rejected_by: userId, rejection_reason: reason }, userId)
    await journalHeadersRepository.clearJournalReferences(id)
    await AuditService.log('REJECT', 'journal_header', id, userId, { status: journal.status }, { status: 'REJECTED', rejection_reason: reason })
    logInfo('Journal rejected', { journal_id: id, user_id: userId, reason })

    const submitterId = journal.submitted_by ?? journal.created_by
    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.JOURNAL_REJECTED,
      companyId,
      {
        entityId: id,
        variables: { journal_number: journal.journal_number, rejection_reason: reason },
        additionalRecipientIds: submitterId ? [submitterId] : [],
        excludeUserIds: [userId],
      }
    )
  }

  async post(id: string, userId: string, branchIds: string[], companyIds: string[]): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds)
    const companyId = journal.company_id
    if (!canTransition(journal.status, 'POSTED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'POSTED')

    const lineErrors = validateJournalLines(journal.lines)
    if (lineErrors.length > 0) throw JournalErrors.INVALID_LINES(lineErrors)
    if (!validateJournalBalance(journal.lines)) throw JournalErrors.NOT_BALANCED()

    const fiscalPeriod = await fiscalPeriodsRepository.findByDate(companyId, journal.journal_date)
    if (!fiscalPeriod || !fiscalPeriod.is_open) throw JournalErrors.PERIOD_CLOSED(journal.period)

    await journalHeadersRepository.updateStatus(id, 'POSTED', userId, { posted_at: new Date().toISOString(), posted_by: userId })
    await AuditService.log('POST', 'journal_header', id, userId, { status: journal.status }, { status: 'POSTED' })
    logInfo('Journal posted', { journal_id: id, user_id: userId })

    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.JOURNAL_POSTED,
      companyId,
      {
        entityId: id,
        variables: { journal_number: journal.journal_number },
        excludeUserIds: [userId],
      }
    )

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

  async reverse(id: string, reason: string, userId: string, branchIds: string[], companyIds: string[]): Promise<JournalHeaderWithLines> {
    const original = await this.getByIdForUser(id, branchIds, companyIds)
    const companyId = original.company_id
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

    await this.submit(reversal.id, userId, branchIds, companyIds)
    await this.approve(reversal.id, userId, branchIds, companyIds)
    await this.post(reversal.id, userId, branchIds, companyIds)
    await journalHeadersRepository.markReversed(id, reversal.id, reason)

    await AuditService.log('REVERSE', 'journal_header', id, userId, { status: original.status, is_reversed: false }, { status: 'REVERSED', reversal_id: reversal.id, reason })
    logInfo('Journal reversed', { original_id: id, reversal_id: reversal.id, user_id: userId, reason })
    return reversal
  }

  async restore(id: string, userId: string, branchIds: string[], companyIds: string[]): Promise<void> {
    const journal = await journalHeadersRepository.findById(id, true)
    if (!journal) throw JournalErrors.NOT_FOUND(id)
    this.assertJournalAccess(journal, branchIds, companyIds, id)
    if (!journal.deleted_at) throw new Error('Journal is not deleted')

    await journalHeadersRepository.restore(id, userId)
    await AuditService.log('RESTORE', 'journal_header', id, userId, { deleted_at: journal.deleted_at }, { deleted_at: null })
    logInfo('Journal restored', { journal_id: id, user_id: userId })
  }

  async forceDelete(id: string, userId: string, branchIds: string[], companyIds: string[]): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds)
    const companyId = journal.company_id
    if (journal.source_module === 'FISCAL_CLOSING') {
      throw JournalErrors.CANNOT_DELETE_POSTED()
    }
      // ── Reverse marketplace settlement jika ada ──
    if (
      journal.reference_type === 'marketplace_checkout_session' &&
      journal.source_module === 'marketplace_po'
    ) {
      // Single settle — reference_id = session id
      if (journal.reference_id) {
        await marketplacePoRepository.reverseSettledSession(
          journal.reference_id,
          id,
          userId,
        )
      }
    } else if (journal.reference_type === 'marketplace_bulk_settlement') {
      // Bulk settle — reverse semua session + hapus sibling journals
      if (journal.reference_id) {
        const allJournalIds = await marketplacePoRepository.reverseBulkSettledSessions(
          journal.reference_id,
          companyId,
          userId,
        )

        // Hapus sibling journals (selain yang sedang di-delete)
        const siblingIds = allJournalIds.filter(jid => jid !== id)
        for (const siblingId of siblingIds) {
          await journalHeadersRepository.clearReversalReferences(siblingId)
          await journalHeadersRepository.clearJournalReferences(siblingId)
          await journalHeadersRepository.delete(siblingId, userId)
          await AuditService.log('FORCE_DELETE', 'journal_header', siblingId, userId, {
            reason: `Sibling bulk settlement journal deleted with ${id}`,
          })
        }
      }
    } else if (
      journal.reference_type === 'ap_payment' &&
      journal.source_module === 'ap_payments' &&
      journal.reference_id
    ) {
      await apPaymentsRepository.revertPaidAfterJournalDelete(journal.reference_id, userId)
    } else if (
      journal.reference_type === 'general_invoice' &&
      journal.source_module === 'general_invoices' &&
      journal.reference_id
    ) {
      // Hard delete cascade: invoice + payments + amortizations
      const invoiceId = journal.reference_id

      // Delete all payment journals + CC settlement journals for this invoice
      const payments = await generalPaymentRepository.findAllByInvoiceId(invoiceId)
      for (const payment of payments) {
        // CC settlement journal cleanup
        if (payment.cc_settlement_id) {
          const settlement = await generalPaymentRepository.findSettlementById(payment.cc_settlement_id)
          if (settlement?.journal_id && settlement.journal_id !== id) {
            await journalHeadersRepository.clearReversalReferences(settlement.journal_id)
            await journalHeadersRepository.clearJournalReferences(settlement.journal_id)
            await journalHeadersRepository.delete(settlement.journal_id, userId)
          }
        }
        // Payment journal
        if (payment.journal_id && payment.journal_id !== id) {
          await journalHeadersRepository.clearReversalReferences(payment.journal_id)
          await journalHeadersRepository.clearJournalReferences(payment.journal_id)
          await journalHeadersRepository.delete(payment.journal_id, userId)
        }
      }

      // Delete all amortization journals for this invoice
      const amortJournalIds = await amortizationRepository.findJournalIdsByInvoiceId(invoiceId)
      for (const ajId of amortJournalIds) {
        if (ajId !== id) {
          await journalHeadersRepository.clearReversalReferences(ajId)
          await journalHeadersRepository.clearJournalReferences(ajId)
          await journalHeadersRepository.delete(ajId, userId)
        }
      }

      // Hard delete settlement records + payments + invoice + lines + amortizations
      await generalInvoiceRepository.withTransaction(async (client) => {
        for (const payment of payments) {
          if (payment.cc_settlement_id) {
            await generalPaymentRepository.deleteSettlementRecord(client, payment.cc_settlement_id)
          }
        }
        await generalPaymentRepository.hardDeleteByInvoiceId(client, invoiceId)
        await generalInvoiceRepository.hardDelete(client, invoiceId)
      })

      await AuditService.log('FORCE_DELETE', 'general_invoices', invoiceId, userId, {
        reason: 'Cascade from journal force delete',
        journal_id: id,
      })
    } else if (
      journal.reference_type === 'general_invoice_payment' &&
      journal.source_module === 'general_invoice_payments' &&
      journal.reference_id
    ) {
      // Hard delete cascade: payment journal → find invoice → delete everything
      const paymentId = journal.reference_id
      const invoiceId = await generalPaymentRepository.findInvoiceIdByPaymentId(paymentId)

      if (invoiceId) {
        // Delete all OTHER payment journals for this invoice
        const allPayments = await generalPaymentRepository.findAllByInvoiceId(invoiceId)
        for (const p of allPayments) {
          if (p.journal_id && p.journal_id !== id) {
            await journalHeadersRepository.clearReversalReferences(p.journal_id)
            await journalHeadersRepository.clearJournalReferences(p.journal_id)
            await journalHeadersRepository.delete(p.journal_id, userId)
          }
        }

        // Delete invoice posting journal
        const invJournalId = await generalInvoiceRepository.findJournalIdByInvoiceId(invoiceId)
        if (invJournalId && invJournalId !== id) {
          await journalHeadersRepository.clearReversalReferences(invJournalId)
          await journalHeadersRepository.clearJournalReferences(invJournalId)
          await journalHeadersRepository.delete(invJournalId, userId)
        }

        // Delete all amortization journals
        const amortJournalIds = await amortizationRepository.findJournalIdsByInvoiceId(invoiceId)
        for (const ajId of amortJournalIds) {
          if (ajId !== id) {
            await journalHeadersRepository.clearReversalReferences(ajId)
            await journalHeadersRepository.clearJournalReferences(ajId)
            await journalHeadersRepository.delete(ajId, userId)
          }
        }

        // Hard delete everything
        await generalInvoiceRepository.withTransaction(async (client) => {
          await generalPaymentRepository.hardDeleteByInvoiceId(client, invoiceId)
          await generalInvoiceRepository.hardDelete(client, invoiceId)
        })

        await AuditService.log('FORCE_DELETE', 'general_invoices', invoiceId, userId, {
          reason: 'Cascade from payment journal force delete',
          journal_id: id,
        })
      }
    } else if (
      journal.reference_type === 'depreciation_run' &&
      journal.source_module === 'fixed_assets' &&
      journal.reference_id
    ) {
      // Depreciation run hard-delete cascade:
      // Rollback accumulated_depreciation, delete movements, entries, run, and sibling journals
      const { reverseDepreciationRunFromJournal } = await import('../../../fixed-assets/depreciation.service')
      await reverseDepreciationRunFromJournal(journal.reference_id, companyId, id, userId)
    }

    await journalHeadersRepository.clearReversalReferences(id)
    await journalHeadersRepository.clearJournalReferences(id)
    await journalHeadersRepository.delete(id, userId)
    await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
      journal_number: journal.journal_number,
      status: journal.status,
    })
    logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
  }
  async getCompleteness(id: string, branchIds: string[], companyIds: string[]): Promise<{
    is_complete: boolean; total_channels: number; reconciled_channels: number;
    unreconciled: Array<{ payment_method_id: number; payment_method_name: string; nett_amount: number; status: string }>
  }> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds)
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
  async getStatusCounts(branchIds: string[], companyIds: string[], dateFrom?: string, dateTo?: string): Promise<Record<string, number>> {
    return journalHeadersRepository.getStatusCounts(branchIds, companyIds, dateFrom, dateTo)
  }

  /** Internal callers: resolve user access scope then run workflow. */
  async submitAsUser(id: string, userId: string): Promise<void> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.submit(id, userId, branchIds, companyIds)
  }

  async approveAsUser(id: string, userId: string): Promise<void> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.approve(id, userId, branchIds, companyIds)
  }

  async postAsUser(id: string, userId: string): Promise<void> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.post(id, userId, branchIds, companyIds)
  }

  async forceDeleteAsUser(id: string, userId: string): Promise<void> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.forceDelete(id, userId, branchIds, companyIds)
  }

  async reverseAsUser(id: string, reason: string, userId: string): Promise<JournalHeaderWithLines> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.reverse(id, reason, userId, branchIds, companyIds)
  }
}

export const journalHeadersService = new JournalHeadersService()
