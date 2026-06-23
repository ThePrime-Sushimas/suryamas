import type { PoolClient } from 'pg'
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
import { purchaseInvoicesRepository } from '../../../purchase-invoices/purchase-invoices.repository'
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
  async getByIdForUser(id: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<JournalHeaderWithLines> {
    const journal = await journalHeadersRepository.findById(id, false, client)
    if (!journal) throw JournalErrors.NOT_FOUND(id)
    this.assertJournalAccess(journal, branchIds, companyIds, id)
    return journal
  }

  /** Internal: company_id on the journal must match (callers pass company from the record). */
  async getById(id: string, companyId: string, client?: PoolClient): Promise<JournalHeaderWithLines> {
    const journal = await journalHeadersRepository.findById(id, false, client)
    if (!journal) throw JournalErrors.NOT_FOUND(id)
    if (journal.company_id !== companyId) throw JournalErrors.NOT_FOUND(id)
    return journal
  }

  async create(data: CreateJournalDto & { company_id: string }, userId: string, client?: PoolClient): Promise<JournalHeaderWithLines> {
    const lineErrors = validateJournalLines(data.lines)
    if (lineErrors.length > 0) throw JournalErrors.INVALID_LINES(lineErrors)
    if (!validateJournalBalance(data.lines)) throw JournalErrors.NOT_BALANCED()

    const accountIds = data.lines.map(line => line.account_id)
    const validationResults = await chartOfAccountsRepository.validateMany(accountIds, data.company_id, true, client)
    for (const line of data.lines) {
      const validation = validationResults.get(line.account_id)
      if (!validation || !validation.valid) throw JournalErrors.VALIDATION_ERROR('account', validation?.error || 'Account validation failed')
    }

    const totals = calculateTotals(data.lines)
    const fiscalPeriod = await fiscalPeriodsRepository.findByDate(data.company_id, data.journal_date, client)
    if (!fiscalPeriod) throw JournalErrors.VALIDATION_ERROR('journal_date', `Tidak ditemukan periode fiskal untuk tanggal ${data.journal_date}`)
    if (!fiscalPeriod.is_open) throw JournalErrors.PERIOD_CLOSED(fiscalPeriod.period)

    const period = fiscalPeriod.period
    const sequence = await journalHeadersRepository.getNextSequence(data.company_id, data.journal_type, period, client)
    const journalNumber = generateJournalNumber(data.journal_type, data.journal_date, sequence)

    const journal = await journalHeadersRepository.create({
      ...data, journal_number: journalNumber, sequence_number: sequence, period,
      total_debit: totals.total_debit, total_credit: totals.total_credit,
      currency: data.currency || 'IDR', exchange_rate: data.exchange_rate || 1, status: 'DRAFT'
    }, userId, client)

    await AuditService.log('CREATE', 'journal_header', journal.id, userId, undefined, {
      journal_number: journal.journal_number, journal_type: journal.journal_type,
      total_debit: journal.total_debit, total_credit: journal.total_credit
    })
    logInfo('Journal created', { journal_id: journal.id, journal_number: journal.journal_number, user_id: userId })
    return journal
  }

  async update(id: string, data: UpdateJournalDto, userId: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<JournalHeaderWithLines> {
    if (client) {
      return this._updateWithClient(id, data, userId, branchIds, companyIds, client)
    }
    // If lines are being updated, we need a transaction to make header update + lines replacement atomic.
    // If no lines, it's a single update call — no wrapping needed.
    if (data.lines) {
      return journalHeadersRepository.withTransaction(async (ownClient) => {
        return this._updateWithClient(id, data, userId, branchIds, companyIds, ownClient)
      })
    }
    // No lines — single write, no transaction needed
    return this._updateWithClient(id, data, userId, branchIds, companyIds)
  }

  private async _updateWithClient(id: string, data: UpdateJournalDto, userId: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<JournalHeaderWithLines> {
    const existing = await this.getByIdForUser(id, branchIds, companyIds, client)
    const companyId = existing.company_id
    if (existing.status !== 'DRAFT') throw JournalErrors.CANNOT_EDIT_NON_DRAFT(existing.status)

    if (data.lines) {
      const lineErrors = validateJournalLines(data.lines)
      if (lineErrors.length > 0) throw JournalErrors.INVALID_LINES(lineErrors)
      if (!validateJournalBalance(data.lines)) throw JournalErrors.NOT_BALANCED()

      const accountIds = data.lines.map(line => line.account_id)
      const validationResults = await chartOfAccountsRepository.validateMany(accountIds, companyId, true, client)
      for (const line of data.lines) {
        const validation = validationResults.get(line.account_id)
        if (!validation || !validation.valid) throw JournalErrors.VALIDATION_ERROR('account', validation?.error || 'Account validation failed')
      }

      const totals = calculateTotals(data.lines)
      const { lines: _lines, ...headerData } = data
      await journalHeadersRepository.update(id, { ...headerData, total_debit: totals.total_debit, total_credit: totals.total_credit }, userId, client)

      const linesWithHeaderId = data.lines.map(line => ({
        ...line, journal_header_id: id, currency: existing.currency, exchange_rate: existing.exchange_rate,
        base_debit_amount: line.debit_amount * existing.exchange_rate, base_credit_amount: line.credit_amount * existing.exchange_rate,
        created_at: new Date().toISOString()
      }))
      await journalHeadersRepository.updateLines(id, linesWithHeaderId, client)
    } else {
      await journalHeadersRepository.update(id, data, userId, client)
    }

    await AuditService.log('UPDATE', 'journal_header', id, userId, { journal_number: existing.journal_number, status: existing.status }, { updates: data })
    return this.getByIdForUser(id, branchIds, companyIds, client)
  }

  async delete(id: string, userId: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<void> {
    if (client) {
      return this._deleteWithClient(id, userId, branchIds, companyIds, client)
    }
    // Self-managed transaction: clearJournalReferences + delete must be atomic
    await journalHeadersRepository.withTransaction(async (ownClient) => {
      await this._deleteWithClient(id, userId, branchIds, companyIds, ownClient)
    })
  }

  private async _deleteWithClient(id: string, userId: string, branchIds: string[], companyIds: string[], client: PoolClient): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds, client)
    if (journal.status !== 'DRAFT' && journal.status !== 'REJECTED') throw JournalErrors.CANNOT_DELETE_POSTED()

    await journalHeadersRepository.clearJournalReferences(id, client)
    await journalHeadersRepository.delete(id, userId, client)
    await AuditService.log('DELETE', 'journal_header', id, userId, { journal_number: journal.journal_number, status: journal.status })
    logInfo('Journal deleted', { journal_id: id, user_id: userId })
  }

  async submit(id: string, userId: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds, client)
    const companyId = journal.company_id
    if (!canTransition(journal.status, 'SUBMITTED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'SUBMITTED')
    await journalHeadersRepository.updateStatus(id, 'SUBMITTED', userId, { submitted_at: new Date().toISOString(), submitted_by: userId }, client)
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

  async approve(id: string, userId: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds, client)
    const companyId = journal.company_id
    if (!canTransition(journal.status, 'APPROVED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'APPROVED')
    await journalHeadersRepository.updateStatus(id, 'APPROVED', userId, { approved_at: new Date().toISOString(), approved_by: userId }, client)
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

  async reject(id: string, reason: string, userId: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<void> {
    if (client) {
      return this._rejectWithClient(id, reason, userId, branchIds, companyIds, client)
    }
    // Self-managed transaction: update status + clearJournalReferences must be atomic
    await journalHeadersRepository.withTransaction(async (ownClient) => {
      await this._rejectWithClient(id, reason, userId, branchIds, companyIds, ownClient)
    })
  }

  private async _rejectWithClient(id: string, reason: string, userId: string, branchIds: string[], companyIds: string[], client: PoolClient): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds, client)
    const companyId = journal.company_id
    if (!canTransition(journal.status, 'REJECTED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'REJECTED')
    await journalHeadersRepository.update(id, { status: 'REJECTED', rejected_at: new Date().toISOString(), rejected_by: userId, rejection_reason: reason }, userId, client)
    await journalHeadersRepository.clearJournalReferences(id, client)
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

  async post(id: string, userId: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<void> {
    const journal = await this.getByIdForUser(id, branchIds, companyIds, client)
    const companyId = journal.company_id
    if (!canTransition(journal.status, 'POSTED')) throw JournalErrors.INVALID_STATUS_TRANSITION(journal.status, 'POSTED')

    const lineErrors = validateJournalLines(journal.lines)
    if (lineErrors.length > 0) throw JournalErrors.INVALID_LINES(lineErrors)
    if (!validateJournalBalance(journal.lines)) throw JournalErrors.NOT_BALANCED()

    const fiscalPeriod = await fiscalPeriodsRepository.findByDate(companyId, journal.journal_date, client)
    if (!fiscalPeriod || !fiscalPeriod.is_open) throw JournalErrors.PERIOD_CLOSED(journal.period)

    await journalHeadersRepository.updateStatus(id, 'POSTED', userId, { posted_at: new Date().toISOString(), posted_by: userId }, client)
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

  async reverse(id: string, reason: string, userId: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<JournalHeaderWithLines> {
    if (client) {
      return this._reverseWithClient(id, reason, userId, branchIds, companyIds, client)
    }
    // Self-managed transaction: create+submit+approve+post+markReversed must be atomic
    return journalHeadersRepository.withTransaction(async (ownClient) => {
      return this._reverseWithClient(id, reason, userId, branchIds, companyIds, ownClient)
    })
  }

  private async _reverseWithClient(id: string, reason: string, userId: string, branchIds: string[], companyIds: string[], client: PoolClient): Promise<JournalHeaderWithLines> {
    const original = await this.getByIdForUser(id, branchIds, companyIds, client)
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
    }, userId, client)

    await this.submit(reversal.id, userId, branchIds, companyIds, client)
    await this.approve(reversal.id, userId, branchIds, companyIds, client)
    await this.post(reversal.id, userId, branchIds, companyIds, client)
    await journalHeadersRepository.markReversed(id, reversal.id, reason, client)

    await AuditService.log('REVERSE', 'journal_header', id, userId, { status: original.status, is_reversed: false }, { status: 'REVERSED', reversal_id: reversal.id, reason })
    logInfo('Journal reversed', { original_id: id, reversal_id: reversal.id, user_id: userId, reason })
    return reversal
  }

  async restore(id: string, userId: string, branchIds: string[], companyIds: string[], client?: PoolClient): Promise<void> {
    const journal = await journalHeadersRepository.findById(id, true, client)
    if (!journal) throw JournalErrors.NOT_FOUND(id)
    this.assertJournalAccess(journal, branchIds, companyIds, id)
    if (!journal.deleted_at) throw new Error('Journal is not deleted')

    await journalHeadersRepository.restore(id, userId, client)
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
      // Marketplace checkout session journal force-delete (atomic):
      // Handles all 4 journal moments (ordered, correction, received, settled).
      // - If this is the "settled" journal: reverseSettledSession reverts session to RECEIVED + cleans settlements.
      // - If this is ordered/received/correction: reverseSettledSession is a no-op (guard returns early).
      // In both cases, clearJournalReferences NULLifies the correct journal_*_id column.
      // Each session journal is INDEPENDENT — deleting one does NOT cascade to the others.
      if (journal.reference_id) {
        await journalHeadersRepository.withTransaction(async (client) => {
          await marketplacePoRepository.reverseSettledSession(
            journal.reference_id!,
            id,
            userId,
            client,
          )
          await journalHeadersRepository.clearReversalReferences(id, client)
          await journalHeadersRepository.clearJournalReferences(id, client)
          await journalHeadersRepository.delete(id, userId, client)
        })

        // Audit log — best-effort, outside transaction
        await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
          journal_number: journal.journal_number,
          status: journal.status,
          marketplace_session_id: journal.reference_id,
        })
        logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
        return // Skip the generic cleanup at bottom — already done inside transaction
      }
    } else if (journal.reference_type === 'marketplace_bulk_settlement') {
      // Bulk settlement journal force-delete cascade (atomic):
      // 1 bulk batch = N journals (one per CC+branch combo), all share the same reference_id (bulkId).
      // Deleting any one journal in the batch cascades to ALL siblings (they are one atomic business op).
      if (journal.reference_id) {
        await journalHeadersRepository.withTransaction(async (client) => {
          // Reverse all sessions + delete settlements (pass client for atomicity)
          const allJournalIds = await marketplacePoRepository.reverseBulkSettledSessions(
            journal.reference_id!,
            companyId,
            userId,
            client,
          )

          // Delete ALL journals in the batch (siblings + the triggering one)
          for (const jId of allJournalIds) {
            await journalHeadersRepository.clearReversalReferences(jId, client)
            await journalHeadersRepository.clearJournalReferences(jId, client)
            await journalHeadersRepository.delete(jId, userId, client)
          }

          // If the triggering journal wasn't in the list (edge case: already soft-deleted before), delete it too
          if (!allJournalIds.includes(id)) {
            await journalHeadersRepository.clearReversalReferences(id, client)
            await journalHeadersRepository.clearJournalReferences(id, client)
            await journalHeadersRepository.delete(id, userId, client)
          }
        })

        // Audit logs — best-effort, outside transaction
        await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
          journal_number: journal.journal_number,
          status: journal.status,
          bulk_settlement_id: journal.reference_id,
          reason: 'Bulk settlement batch cascade delete',
        })
        logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
        return // Skip the generic cleanup at bottom — already done inside transaction
      }
    } else if (
      journal.reference_type === 'ap_payment' &&
      journal.source_module === 'ap_payments' &&
      journal.reference_id
    ) {
      // AP payment journal force-delete (atomic):
      // Revert payment status + delete this journal in a single transaction.
      await journalHeadersRepository.withTransaction(async (client) => {
        await apPaymentsRepository.revertPaidAfterJournalDelete(journal.reference_id!, userId, client)
        await journalHeadersRepository.clearReversalReferences(id, client)
        await journalHeadersRepository.clearJournalReferences(id, client)
        await journalHeadersRepository.delete(id, userId, client)
      })

      // Audit log — best-effort, outside transaction
      await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
        journal_number: journal.journal_number,
        status: journal.status,
        ap_payment_id: journal.reference_id,
      })
      logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
      return // Skip the generic cleanup at bottom — already done inside transaction
    } else if (
      journal.reference_type === 'general_invoice' &&
      journal.source_module === 'general_invoices' &&
      journal.reference_id
    ) {
      // General invoice journal force-delete cascade (atomic):
      // Deletes: all payment journals, CC settlement journals, amortization journals,
      // settlement records, payments, invoice — plus the triggering journal itself.
      const invoiceId = journal.reference_id

      // ── Reads: collect all related IDs before opening transaction ──
      const payments = await generalPaymentRepository.findAllByInvoiceId(invoiceId)
      const settlements: Array<{ paymentCcSettlementId: string; journalId: string }> = []
      for (const payment of payments) {
        if (payment.cc_settlement_id) {
          const settlement = await generalPaymentRepository.findSettlementById(payment.cc_settlement_id)
          if (settlement?.journal_id && settlement.journal_id !== id) {
            settlements.push({ paymentCcSettlementId: payment.cc_settlement_id, journalId: settlement.journal_id })
          }
        }
      }
      const amortJournalIds = await amortizationRepository.findJournalIdsByInvoiceId(invoiceId)

      // ── All writes in one transaction ──
      await journalHeadersRepository.withTransaction(async (client) => {
        // 1. Delete CC settlement journals
        for (const s of settlements) {
          await journalHeadersRepository.clearReversalReferences(s.journalId, client)
          await journalHeadersRepository.clearJournalReferences(s.journalId, client)
          await journalHeadersRepository.delete(s.journalId, userId, client)
        }

        // 2. Delete payment journals
        for (const payment of payments) {
          if (payment.journal_id && payment.journal_id !== id) {
            await journalHeadersRepository.clearReversalReferences(payment.journal_id, client)
            await journalHeadersRepository.clearJournalReferences(payment.journal_id, client)
            await journalHeadersRepository.delete(payment.journal_id, userId, client)
          }
        }

        // 3. Delete amortization journals
        for (const ajId of amortJournalIds) {
          if (ajId !== id) {
            await journalHeadersRepository.clearReversalReferences(ajId, client)
            await journalHeadersRepository.clearJournalReferences(ajId, client)
            await journalHeadersRepository.delete(ajId, userId, client)
          }
        }

        // 4. Hard delete settlement records, payments, invoice (lines + amortizations)
        for (const s of settlements) {
          await generalPaymentRepository.deleteSettlementRecord(client, s.paymentCcSettlementId)
        }
        await generalPaymentRepository.hardDeleteByInvoiceId(client, invoiceId)
        await generalInvoiceRepository.hardDelete(client, invoiceId)

        // 5. Delete the triggering journal itself
        await journalHeadersRepository.clearReversalReferences(id, client)
        await journalHeadersRepository.clearJournalReferences(id, client)
        await journalHeadersRepository.delete(id, userId, client)
      })

      // Audit logs — best-effort, outside transaction
      await AuditService.log('FORCE_DELETE', 'general_invoices', invoiceId, userId, {
        reason: 'Cascade from journal force delete',
        journal_id: id,
      })
      await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
        journal_number: journal.journal_number,
        status: journal.status,
      })
      logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
      return // Skip the generic cleanup at bottom — already done inside transaction
    } else if (
      journal.reference_type === 'general_invoice_payment' &&
      journal.source_module === 'general_invoice_payments' &&
      journal.reference_id
    ) {
      // General invoice payment journal force-delete cascade (atomic):
      // Triggered from a payment journal → finds parent invoice → deletes everything.
      const paymentId = journal.reference_id
      const invoiceId = await generalPaymentRepository.findInvoiceIdByPaymentId(paymentId)

      if (invoiceId) {
        // ── Reads: collect all related IDs before opening transaction ──
        const allPayments = await generalPaymentRepository.findAllByInvoiceId(invoiceId)
        const invJournalId = await generalInvoiceRepository.findJournalIdByInvoiceId(invoiceId)
        const amortJournalIds = await amortizationRepository.findJournalIdsByInvoiceId(invoiceId)

        // ── All writes in one transaction ──
        await journalHeadersRepository.withTransaction(async (client) => {
          // 1. Delete all OTHER payment journals for this invoice
          for (const p of allPayments) {
            if (p.journal_id && p.journal_id !== id) {
              await journalHeadersRepository.clearReversalReferences(p.journal_id, client)
              await journalHeadersRepository.clearJournalReferences(p.journal_id, client)
              await journalHeadersRepository.delete(p.journal_id, userId, client)
            }
          }

          // 2. Delete the invoice posting journal
          if (invJournalId && invJournalId !== id) {
            await journalHeadersRepository.clearReversalReferences(invJournalId, client)
            await journalHeadersRepository.clearJournalReferences(invJournalId, client)
            await journalHeadersRepository.delete(invJournalId, userId, client)
          }

          // 3. Delete amortization journals
          for (const ajId of amortJournalIds) {
            if (ajId !== id) {
              await journalHeadersRepository.clearReversalReferences(ajId, client)
              await journalHeadersRepository.clearJournalReferences(ajId, client)
              await journalHeadersRepository.delete(ajId, userId, client)
            }
          }

          // 4. Hard delete payments + invoice (lines + amortizations)
          await generalPaymentRepository.hardDeleteByInvoiceId(client, invoiceId)
          await generalInvoiceRepository.hardDelete(client, invoiceId)

          // 5. Delete the triggering payment journal itself
          await journalHeadersRepository.clearReversalReferences(id, client)
          await journalHeadersRepository.clearJournalReferences(id, client)
          await journalHeadersRepository.delete(id, userId, client)
        })

        // Audit logs — best-effort, outside transaction
        await AuditService.log('FORCE_DELETE', 'general_invoices', invoiceId, userId, {
          reason: 'Cascade from payment journal force delete',
          journal_id: id,
        })
        await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
          journal_number: journal.journal_number,
          status: journal.status,
        })
        logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
        return // Skip the generic cleanup at bottom — already done inside transaction
      }
      // If no invoiceId found: fall through to generic cleanup (delete orphan journal only)
    } else if (
      journal.reference_type === 'depreciation_run' &&
      journal.source_module === 'fixed_assets' &&
      journal.reference_id
    ) {
      // Depreciation run hard-delete cascade (atomic):
      // 1 run = N journals (one per branch). All siblings cascade-deleted together.
      // Guard checks (run status, fiscal period) run BEFORE transaction — read-only, no side effects.
      const { reverseDepreciationRunFromJournal } = await import('../../../fixed-assets/depreciation.service')

      await journalHeadersRepository.withTransaction(async (client) => {
        // reverseDepreciationRunFromJournal handles: rollback accum_depr, delete movements/entries/run,
        // and bulkHardDelete sibling journals (excluding triggerJournalId which we delete below).
        await reverseDepreciationRunFromJournal(journal.reference_id!, companyId, id, userId, client)

        // Delete the triggering journal itself
        await journalHeadersRepository.clearReversalReferences(id, client)
        await journalHeadersRepository.clearJournalReferences(id, client)
        await journalHeadersRepository.delete(id, userId, client)
      })

      // Audit log for the triggering journal — best-effort, outside transaction
      // (reverseDepreciationRunFromJournal already logs its own audit for the run)
      await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
        journal_number: journal.journal_number,
        status: journal.status,
        depreciation_run_id: journal.reference_id,
      })
      logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
      return // Skip the generic cleanup at bottom — already done inside transaction
    } else if (
      journal.reference_type === 'asset_opening_balance' &&
      journal.source_module === 'fixed_assets' &&
      journal.reference_id
    ) {
      // Opening balance asset hard-delete cascade (atomic):
      // The asset was created solely by this journal — remove asset + movements + journal in one tx.
      // No siblings — 1 asset = 1 opening balance journal.
      const { hardDeleteAssetByJournalId } = await import('../../../fixed-assets/fixed-assets.repository')

      let deletedAssetId: string | null = null
      await journalHeadersRepository.withTransaction(async (client) => {
        deletedAssetId = await hardDeleteAssetByJournalId(id, client)
        await journalHeadersRepository.clearReversalReferences(id, client)
        await journalHeadersRepository.clearJournalReferences(id, client)
        await journalHeadersRepository.delete(id, userId, client)
      })

      // Audit logs — best-effort, outside transaction
      if (deletedAssetId) {
        await AuditService.log('FORCE_DELETE', 'fixed_asset', deletedAssetId, userId, {
          reason: 'Cascade from opening balance journal force delete',
          journal_id: id,
        })
      }
      await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
        journal_number: journal.journal_number,
        status: journal.status,
      })
      logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
      return // Skip the generic cleanup at bottom — already done inside transaction
    } else if (
      journal.reference_type === 'purchase_invoice' &&
      journal.source_module === 'purchase_invoice' &&
      journal.reference_id
    ) {
      // Purchase invoice journal force-delete cascade (atomic):
      // All operations run in a single transaction — if any step fails, nothing is committed.
      // Order: delete AP payment journals → revert AP payments → revert PI → delete this journal.
      const piId = journal.reference_id

      const linkedPayments = await apPaymentsRepository.findPaymentIdsWithJournalByInvoiceId(piId)

      await journalHeadersRepository.withTransaction(async (client) => {
        // 1. Delete AP payment journals linked to this PI
        for (const payment of linkedPayments) {
          // AP payment journals always have a different source_module ('ap_payments')
          // than the PI journal ('purchase_invoice'), so journal IDs are always distinct.
          await journalHeadersRepository.clearReversalReferences(payment.journal_id, client)
          await journalHeadersRepository.clearJournalReferences(payment.journal_id, client)
          await journalHeadersRepository.delete(payment.journal_id, userId, client)
        }

        // 2. Revert AP payment status (PAID/RECONCILED → APPROVED)
        for (const payment of linkedPayments) {
          await apPaymentsRepository.revertPaidAfterJournalDelete(payment.id, userId, client)
        }

        // 3. Revert PI status back to APPROVED
        await purchaseInvoicesRepository.updateStatus(client, piId, 'APPROVED', {
          journal_id: null,
          posted_by: null,
          posted_at: null,
          updated_by: userId,
        })

        // 4. Delete the PI journal itself (the one being force-deleted)
        await journalHeadersRepository.clearReversalReferences(id, client)
        await journalHeadersRepository.clearJournalReferences(id, client)
        await journalHeadersRepository.delete(id, userId, client)
      })

      // Audit logs — best-effort, outside transaction
      for (const payment of linkedPayments) {
        await AuditService.log('FORCE_DELETE', 'journal_header', payment.journal_id, userId, {
          reason: 'AP payment journal deleted via PI journal cascade',
          purchase_invoice_id: piId,
        })
      }
      await AuditService.log('FORCE_DELETE', 'purchase_invoices', piId, userId, {
        reason: 'Cascade from PI journal force delete',
        journal_id: id,
        ap_payments_reverted: linkedPayments.length,
      })
      await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
        journal_number: journal.journal_number,
        status: journal.status,
      })
      logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
      return // Skip the generic cleanup at bottom — already done inside transaction
    } else if (
      journal.reference_type === 'fixed_asset' &&
      journal.source_module === 'fixed_assets' &&
      journal.reference_id
    ) {
      // Fixed asset capitalization journal force-delete (atomic):
      // Guard check runs BEFORE transaction — read-only, no side effects to rollback.
      const { hasDepreciationEntries, revertCapitalizationFromJournal } = await import('../../../fixed-assets/fixed-assets.repository')
      const hasDep = await hasDepreciationEntries(journal.reference_id)
      if (hasDep) {
        throw JournalErrors.CANNOT_DELETE_POSTED()
      }

      // All mutations in a single transaction — if any step fails, nothing is committed.
      await journalHeadersRepository.withTransaction(async (client) => {
        await revertCapitalizationFromJournal(journal.reference_id!, userId, client)
        await journalHeadersRepository.clearReversalReferences(id, client)
        await journalHeadersRepository.clearJournalReferences(id, client)
        await journalHeadersRepository.delete(id, userId, client)
      })

      // Audit logs — best-effort, outside transaction
      await AuditService.log('FORCE_DELETE', 'fixed_asset_capitalization', journal.reference_id, userId, {
        reason: 'Cascade from capitalization journal force delete',
        journal_id: id,
      })
      await AuditService.log('FORCE_DELETE', 'journal_header', id, userId, {
        journal_number: journal.journal_number,
        status: journal.status,
      })
      logInfo('Journal force deleted', { journal_id: id, user_id: userId, status: journal.status })
      return // Skip the generic cleanup at bottom — already done inside transaction
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
  async submitAsUser(id: string, userId: string, client?: PoolClient): Promise<void> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.submit(id, userId, branchIds, companyIds, client)
  }

  async approveAsUser(id: string, userId: string, client?: PoolClient): Promise<void> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.approve(id, userId, branchIds, companyIds, client)
  }

  async postAsUser(id: string, userId: string, client?: PoolClient): Promise<void> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.post(id, userId, branchIds, companyIds, client)
  }

  async forceDeleteAsUser(id: string, userId: string): Promise<void> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.forceDelete(id, userId, branchIds, companyIds)
  }

  async reverseAsUser(id: string, reason: string, userId: string, client?: PoolClient): Promise<JournalHeaderWithLines> {
    const { branchIds, companyIds } = await getAccessScope(userId)
    return this.reverse(id, reason, userId, branchIds, companyIds, client)
  }
}

export const journalHeadersService = new JournalHeadersService()
