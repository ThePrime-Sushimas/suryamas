import { bankMutationEntriesRepository, BankMutationEntriesRepository } from './bank-mutation-entries.repository'
import { bankReconciliationRepository } from '../bank-reconciliation/bank-reconciliation.repository'
import { chartOfAccountsRepository } from '../../accounting/chart-of-accounts/chart-of-accounts.repository'
import { journalHeadersService } from '../../accounting/journals/journal-headers/journal-headers.service'
import { AuditService } from '../../monitoring/monitoring.service'
import { logError, logInfo } from '../../../config/logger'
import { createPaginatedResponse } from '../../../utils/pagination.util'
import {
  BankMutationEntryAlreadyReconciledError,
  BankMutationEntryAlreadyVoidedError,
  BankMutationEntryStatementAlreadyMatchedError,
  BankMutationEntryNotFoundError,
} from './bank-mutation-entries.errors'
import {
  BANK_MUTATION_ENTRY_TYPE_CONFIG,
  type ReconcileBankStatementWithMutationEntryDto,
  type VoidBankMutationEntryDto,
  type ListBankMutationEntriesFilter,
  type BankMutationEntryDetail,
  type BankMutationEntryType,
} from './bank-mutation-entries.types'
import type { JournalType } from '../../accounting/journals/shared/journal.types'
import { BusinessRuleError } from '../../../utils/errors.base'

const RECONCILIATION_SOURCE = 'BANK_MUTATION_ENTRY' as const
const JOURNAL_SOURCE_MODULE = 'BANK_MUTATION_ENTRY' as const
const JOURNAL_REFERENCE_TYPE = 'bank_mutation_entry' as const

export class BankMutationEntriesService {
  constructor(private readonly repository: BankMutationEntriesRepository) {}

  /**
   * One-step: create mutation entry + reconcile bank statement + auto-create journal DRAFT
   */
  async reconcileWithMutationEntry(
    dto: ReconcileBankStatementWithMutationEntryDto,
    userId: string,
    companyId: string,
  ): Promise<BankMutationEntryDetail> {
    // 1. Validate bank statement exists & not already reconciled
    const statement = await bankReconciliationRepository.findById(dto.bankStatementId)
    if (statement.is_reconciled) {
      throw new BankMutationEntryStatementAlreadyMatchedError(dto.bankStatementId)
    }

    // Check no existing mutation entry for this statement
    const existing = await this.repository.findByBankStatementId(dto.bankStatementId)
    if (existing) {
      throw new BankMutationEntryAlreadyReconciledError(dto.bankStatementId)
    }

    // 2. Validate COA exists & is postable
    const coaValidation = await chartOfAccountsRepository.validateMany([dto.coaId], companyId)
    const coaResult = coaValidation.get(dto.coaId)
    if (!coaResult?.valid) {
      throw new BusinessRuleError(coaResult?.error || 'COA tidak valid', { coaId: dto.coaId })
    }
    const coa = coaResult.account!

    // 3. Derive defaults from bank statement
    const entryDate = dto.entryDate || statement.transaction_date?.split('T')[0]
    const bankAmount = (statement.credit_amount || 0) - (statement.debit_amount || 0)
    const amount = dto.amount ?? bankAmount

    // 4. Create mutation entry (already reconciled)
    const entry = await this.repository.create({
      companyId,
      entryDate,
      entryType: dto.entryType,
      description: dto.description,
      amount,
      referenceNumber: dto.referenceNumber,
      bankAccountId: statement.bank_account_id,
      coaId: dto.coaId,
      coaCode: coa.account_code,
      coaName: coa.account_name,
      bankStatementId: dto.bankStatementId,
      reconciledBy: userId,
      notes: dto.notes,
      createdBy: userId,
    })

    // 5. Link bank statement → mutation entry
    await this.repository.linkBankStatement(dto.bankStatementId, entry.id, userId)

    // 6. Auto-create journal DRAFT
    await this.createJournalForEntry(entry.id, {
      companyId,
      entryDate,
      entryType: dto.entryType,
      description: dto.description,
      amount: Math.abs(amount),
      coaId: dto.coaId,
      bankAccountId: statement.bank_account_id,
      referenceNumber: dto.referenceNumber,
    }, userId)

    // 7. Audit log
    await AuditService.log('CREATE', 'bank_mutation_entry', entry.id, userId, null, {
      bankStatementId: dto.bankStatementId,
      entryType: dto.entryType,
      amount,
      coaId: dto.coaId,
    })

    // 8. Reconciliation log
    await bankReconciliationRepository.logAction({
      companyId,
      userId,
      action: 'MANUAL_RECONCILE',
      statementId: dto.bankStatementId,
      details: {
        mutationEntryId: entry.id,
        entryType: dto.entryType,
        source: RECONCILIATION_SOURCE,
      },
    })

    logInfo('Bank mutation entry created & reconciled', {
      entryId: entry.id,
      statementId: dto.bankStatementId,
      entryType: dto.entryType,
    })

    return this.toDetail(entry)
  }

  /**
   * Void a mutation entry — undo reconciliation + reverse journal
   */
  async voidEntry(
    id: string,
    dto: VoidBankMutationEntryDto,
    userId: string,
    companyId: string,
  ): Promise<void> {
    const entry = await this.repository.findByIdOrThrow(id, companyId)

    if (entry.status === 'VOIDED') {
      throw new BankMutationEntryAlreadyVoidedError(id)
    }

    // 1. Unlink bank statement
    if (entry.bank_statement_id) {
      await this.repository.unlinkBankStatement(String(entry.bank_statement_id), userId)
    }

    // 2. Reverse journal if exists
    if (entry.journal_header_id) {
      try {
        await journalHeadersService.reverse(
          entry.journal_header_id,
          `VOID mutation entry: ${dto.voidReason}`,
          userId,
          companyId,
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        logError('Failed to reverse journal for voided mutation entry', {
          entryId: id, journalId: entry.journal_header_id, error: message,
        })
        // Don't block void — journal might already be reversed/deleted
      }
    }

    // 3. Void the entry
    await this.repository.voidEntry(id, dto.voidReason, userId)

    // 4. Audit log
    await AuditService.log('DELETE', 'bank_mutation_entry', id, userId,
      { status: 'ACTIVE', is_reconciled: true },
      { status: 'VOIDED', void_reason: dto.voidReason },
    )

    logInfo('Bank mutation entry voided', { entryId: id, reason: dto.voidReason })
  }

  /**
   * List mutation entries with pagination
   */
  async list(filter: ListBankMutationEntriesFilter) {
    const page = filter.page || 1
    const limit = filter.limit || 50
    const offset = (page - 1) * limit

    const { data, total } = await this.repository.list({
      companyId: filter.companyId,
      bankAccountId: filter.bankAccountId,
      entryType: filter.entryType,
      status: filter.status,
      isReconciled: filter.isReconciled,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      search: filter.search,
      limit,
      offset,
    })

    return createPaginatedResponse(data.map(r => this.toDetail(r)), total, page, limit)
  }

  /**
   * Get single entry detail
   */
  async getById(id: string, companyId: string): Promise<BankMutationEntryDetail> {
    const entry = await this.repository.findByIdOrThrow(id, companyId)
    return this.toDetail(entry)
  }

  /**
   * Get COA suggestions based on entry type hint
   */
  async getCoaSuggestions(entryType: BankMutationEntryType, companyId: string) {
    const config = BANK_MUTATION_ENTRY_TYPE_CONFIG[entryType]
    if (!config.defaultCoaHint) return []

    const { data } = await chartOfAccountsRepository.search(
      companyId,
      config.defaultCoaHint,
      { limit: 10, offset: 0 },
      undefined,
      { is_active: true },
    )
    return data
  }

  // ── Private helpers ──

  private async createJournalForEntry(
    entryId: string,
    params: {
      companyId: string
      entryDate: string
      entryType: BankMutationEntryType
      description: string
      amount: number
      coaId: string
      bankAccountId: number
      referenceNumber?: string
    },
    userId: string,
  ): Promise<void> {
    try {
      const bankCoaId = await this.repository.getBankAccountCoaId(params.bankAccountId)
      if (!bankCoaId) {
        logError('Bank account has no linked COA, skipping journal creation', {
          bankAccountId: params.bankAccountId, entryId,
        })
        return
      }

      const typeConfig = BANK_MUTATION_ENTRY_TYPE_CONFIG[params.entryType]

      // Determine debit/credit based on entry type
      // isDebit = true → expense/outflow: Debit COA, Credit Bank
      // isDebit = false → income/inflow: Debit Bank, Credit COA
      const lines = typeConfig.isDebit
        ? [
            { line_number: 1, account_id: params.coaId, description: params.description, debit_amount: params.amount, credit_amount: 0 },
            { line_number: 2, account_id: bankCoaId, description: params.description, debit_amount: 0, credit_amount: params.amount },
          ]
        : [
            { line_number: 1, account_id: bankCoaId, description: params.description, debit_amount: params.amount, credit_amount: 0 },
            { line_number: 2, account_id: params.coaId, description: params.description, debit_amount: 0, credit_amount: params.amount },
          ]

      const journal = await journalHeadersService.create({
        company_id: params.companyId,
        journal_date: params.entryDate,
        journal_type: 'BANK' as JournalType,
        description: `[${typeConfig.label}] ${params.description}`,
        source_module: JOURNAL_SOURCE_MODULE,
        reference_type: JOURNAL_REFERENCE_TYPE,
        reference_id: entryId,
        reference_number: params.referenceNumber || undefined,
        lines,
      }, userId)

      // Link journal back to entry
      await this.repository.updateJournalHeaderId(entryId, journal.id)

      logInfo('Journal created for bank mutation entry', {
        entryId, journalId: journal.id, journalNumber: journal.journal_number,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      logError('Failed to create journal for bank mutation entry', {
        entryId, error: message,
      })
      // Don't throw — entry is already created & reconciled. Journal can be created manually later.
    }
  }

  private toDetail(row: import('./bank-mutation-entries.types').BankMutationEntryRow): BankMutationEntryDetail {
    const config = BANK_MUTATION_ENTRY_TYPE_CONFIG[row.entry_type]
    return {
      id: row.id,
      entryDate: row.entry_date,
      entryType: row.entry_type,
      entryTypeLabel: config?.label || row.entry_type,
      description: row.description,
      amount: Number(row.amount),
      referenceNumber: row.reference_number,
      bankAccountId: row.bank_account_id,
      bankAccountName: null, // Populated by controller/join if needed
      coaId: row.coa_id,
      coaCode: row.coa_code,
      coaName: row.coa_name,
      bankStatementId: row.bank_statement_id,
      isReconciled: row.is_reconciled,
      reconciledAt: row.reconciled_at,
      journalHeaderId: row.journal_header_id,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
    }
  }
}

export const bankMutationEntriesService = new BankMutationEntriesService(bankMutationEntriesRepository)
