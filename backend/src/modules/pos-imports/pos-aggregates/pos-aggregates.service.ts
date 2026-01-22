import { supabase } from '../../../config/supabase'
import { posAggregatesRepository } from './pos-aggregates.repository'
import { 
  AggregatedTransaction, 
  AggregatedTransactionWithDetails,
  AggregatedTransactionListItem,
  AggregatedTransactionFilterParams,
  AggregatedTransactionSortParams,
  AggregatedTransactionStatus,
  AggregatedTransactionSourceType,
  CreateAggregatedTransactionDto,
  UpdateAggregatedTransactionDto,
  AggregatedTransactionSummary,
  AggregatedTransactionBatchResult,
  GenerateJournalRequestDto
} from './pos-aggregates.types'
import { 
  AggregatedTransactionErrors 
} from './pos-aggregates.errors'
import { getPaginationParams, createPaginatedResponse } from '../../../utils/pagination.util'
import { logInfo, logError } from '../../../config/logger'

export class PosAggregatesService {
  /**
   * Validate that company exists and is active
   */
  private async validateCompany(companyId: string): Promise<void> {
    const { data, error } = await supabase
      .from('companies')
      .select('id, status')
      .eq('id', companyId)
      .maybeSingle()

    if (error) throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to validate company', error)
    if (!data) throw AggregatedTransactionErrors.COMPANY_NOT_FOUND(companyId)
    if ((data as any).status === 'closed') {
      throw AggregatedTransactionErrors.COMPANY_INACTIVE(companyId)
    }
  }

  /**
   * Validate that branch exists (if provided)
   */
  private async validateBranch(branchId: string | null): Promise<void> {
    if (!branchId) return

    const { data, error } = await supabase
      .from('branches')
      .select('id, is_active')
      .eq('id', branchId)
      .maybeSingle()

    if (error) throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to validate branch', error)
    if (!data) throw AggregatedTransactionErrors.BRANCH_NOT_FOUND(branchId)
    if (!(data as any).is_active) {
      throw AggregatedTransactionErrors.BRANCH_INACTIVE(branchId)
    }
  }

  /**
   * Validate that payment method exists and is active
   */
  private async validatePaymentMethod(paymentMethodId: number): Promise<void> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, is_active')
      .eq('id', paymentMethodId)
      .maybeSingle()

    if (error) throw AggregatedTransactionErrors.DATABASE_ERROR('Failed to validate payment method', error)
    if (!data) throw AggregatedTransactionErrors.PAYMENT_METHOD_NOT_FOUND(paymentMethodId.toString())
    if (!(data as any).is_active) {
      throw AggregatedTransactionErrors.PAYMENT_METHOD_INACTIVE(paymentMethodId.toString())
    }
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: AggregatedTransactionStatus, 
    newStatus: AggregatedTransactionStatus
  ): void {
    const validTransitions: Record<AggregatedTransactionStatus, AggregatedTransactionStatus[]> = {
      READY: ['PENDING', 'CANCELLED'],
      PENDING: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw AggregatedTransactionErrors.INVALID_STATUS_TRANSITION(
        currentStatus, 
        newStatus
      )
    }
  }

  /**
   * Convert CreateDto to Repository insert format
   */
  private toInsertData(data: CreateAggregatedTransactionDto): Omit<AggregatedTransaction, 'id' | 'created_at' | 'updated_at' | 'version'> {
    return {
      company_id: data.company_id,
      branch_id: data.branch_id ?? null,
      source_type: data.source_type,
      source_id: data.source_id,
      source_ref: data.source_ref,
      transaction_date: data.transaction_date,
      payment_method_id: data.payment_method_id,
      gross_amount: data.gross_amount,
      discount_amount: data.discount_amount ?? 0,
      tax_amount: data.tax_amount ?? 0,
      service_charge_amount: data.service_charge_amount ?? 0,
      net_amount: data.net_amount,
      currency: data.currency ?? 'IDR',
      journal_id: null,
      is_reconciled: false,
      status: data.status ?? 'READY',
      deleted_at: null,
    }
  }

  /**
   * Create new aggregated transaction
   */
  async createTransaction(data: CreateAggregatedTransactionDto): Promise<AggregatedTransaction> {
    await this.validateCompany(data.company_id)
    await this.validateBranch(data.branch_id ?? null)
    await this.validatePaymentMethod(data.payment_method_id)

    const exists = await posAggregatesRepository.sourceExists(
      data.source_type,
      data.source_id,
      data.source_ref
    )

    if (exists) {
      throw AggregatedTransactionErrors.DUPLICATE_SOURCE(
        data.source_type,
        data.source_id,
        data.source_ref
      )
    }

    logInfo('Creating aggregated transaction', {
      source_type: data.source_type,
      source_id: data.source_id,
      source_ref: data.source_ref,
      company_id: data.company_id
    })

    const insertData = this.toInsertData(data)
    return posAggregatesRepository.create(insertData)
  }

  /**
   * Create multiple transactions (batch)
   */
  async createBatch(
    transactions: CreateAggregatedTransactionDto[]
  ): Promise<AggregatedTransactionBatchResult> {
    const results: AggregatedTransactionBatchResult = {
      success: [],
      failed: [],
      total_processed: transactions.length
    }

    for (const tx of transactions) {
      try {
        await this.createTransaction(tx)
        results.success.push(tx.source_ref)
      } catch (err) {
        results.failed.push({
          source_ref: tx.source_ref,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        logError('Failed to create transaction in batch', { 
          source_ref: tx.source_ref, 
          error: err 
        })
      }
    }

    logInfo('Batch transaction creation completed', {
      total: transactions.length,
      success: results.success.length,
      failed: results.failed.length
    })

    return results
  }

  /**
   * Get single transaction by ID
   */
  async getTransactionById(id: string): Promise<AggregatedTransactionWithDetails> {
    const transaction = await posAggregatesRepository.findById(id)
    if (!transaction) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }
    return transaction
  }

  /**
   * Get transactions with pagination and filters
   */
  async getTransactions(
    filter?: AggregatedTransactionFilterParams,
    sort?: AggregatedTransactionSortParams
  ) {
    const { page, limit, offset } = getPaginationParams(filter as any)
    const { data, total } = await posAggregatesRepository.findAll(
      { limit, offset },
      filter,
      sort
    )
    
    return createPaginatedResponse(data, total, page, limit)
  }

  /**
   * Update transaction
   */
  async updateTransaction(
    id: string, 
    updates: UpdateAggregatedTransactionDto,
    expectedVersion?: number
  ): Promise<AggregatedTransaction> {
    const existing = await posAggregatesRepository.findById(id)
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }

    if (updates.status && updates.status !== existing.status) {
      this.validateStatusTransition(existing.status, updates.status)
    }

    if (updates.payment_method_id) {
      await this.validatePaymentMethod(updates.payment_method_id)
    }

    if (updates.branch_id !== undefined) {
      await this.validateBranch(updates.branch_id)
    }

    logInfo('Updating aggregated transaction', {
      id,
      expected_version: expectedVersion,
      updates: Object.keys(updates)
    })

    try {
      return await posAggregatesRepository.update(id, updates, expectedVersion)
    } catch (err: any) {
      if (err.message?.includes('version') || err.code === 'P0001') {
        throw AggregatedTransactionErrors.VERSION_CONFLICT(
          id, 
          expectedVersion || existing.version, 
          (expectedVersion || existing.version) + 1
        )
      }
      throw err
    }
  }

  /**
   * Soft delete transaction
   */
  async deleteTransaction(id: string, deletedBy?: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id)
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }

    if (existing.status === 'COMPLETED') {
      throw AggregatedTransactionErrors.CANNOT_DELETE_COMPLETED(id)
    }

    logInfo('Deleting aggregated transaction', {
      id,
      status: existing.status,
      deleted_by: deletedBy
    })

    await posAggregatesRepository.softDelete(id, deletedBy)
  }

  /**
   * Restore soft-deleted transaction
   */
  async restoreTransaction(id: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id)
    if (existing && !existing.deleted_at) {
      throw AggregatedTransactionErrors.ALREADY_ACTIVE(id)
    }

    logInfo('Restoring aggregated transaction', { id })
    await posAggregatesRepository.restore(id)
  }

  /**
   * Mark transaction as reconciled
   */
  async reconcileTransaction(id: string, reconciledBy: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id)
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }

    if (existing.is_reconciled) {
      throw AggregatedTransactionErrors.ALREADY_RECONCILED(id)
    }

    if (!existing.journal_id) {
      throw AggregatedTransactionErrors.NO_JOURNAL_ASSIGNED(id)
    }

    logInfo('Reconciling transaction', { id, reconciled_by: reconciledBy })
    await posAggregatesRepository.markReconciled([id], reconciledBy)
  }

  /**
   * Batch reconcile transactions
   */
  async reconcileBatch(transactionIds: string[], reconciledBy: string): Promise<number> {
    let reconciled = 0

    for (const id of transactionIds) {
      try {
        const existing = await posAggregatesRepository.findById(id)
        if (existing && !existing.is_reconciled && existing.journal_id) {
          await posAggregatesRepository.markReconciled([id], reconciledBy)
          reconciled++
        }
      } catch (err) {
        logError('Failed to reconcile transaction', { id, error: err })
      }
    }

    logInfo('Batch reconciliation completed', {
      total: transactionIds.length,
      reconciled
    })

    return reconciled
  }

  /**
   * Get summary statistics
   */
  async getSummary(
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
    branchId?: string
  ): Promise<AggregatedTransactionSummary> {
    await this.validateCompany(companyId)

    const summary = await posAggregatesRepository.getSummary(
      companyId,
      dateFrom,
      dateTo,
      branchId
    )

    const statusCounts = await posAggregatesRepository.getStatusCounts(companyId)

    return {
      ...summary,
      by_status: statusCounts
    }
  }

  /**
   * Get unreconciled transactions for journal generation
   */
  async getUnreconciledTransactions(
    companyId: string,
    dateFrom: string,
    dateTo: string,
    branchId?: string
  ): Promise<AggregatedTransaction[]> {
    await this.validateCompany(companyId)

    return posAggregatesRepository.findUnreconciled(
      companyId,
      dateFrom,
      dateTo,
      branchId
    )
  }

  /**
   * Assign journal to transaction
   */
  async assignJournal(id: string, journalId: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id)
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id)
    }

    if (existing.journal_id) {
      throw AggregatedTransactionErrors.JOURNAL_ALREADY_ASSIGNED(id)
    }

    logInfo('Assigning journal to transaction', { id, journal_id: journalId })
    await posAggregatesRepository.assignJournal(id, journalId)
  }

  /**
   * Assign journal to multiple transactions (batch)
   */
  async assignJournalBatch(
    transactionIds: string[],
    journalId: string
  ): Promise<{ assigned: number; skipped: number }> {
    let assigned = 0
    let skipped = 0

    for (const id of transactionIds) {
      try {
        const existing = await posAggregatesRepository.findById(id)
        if (existing && !existing.journal_id) {
          await posAggregatesRepository.assignJournal(id, journalId)
          assigned++
        } else {
          skipped++
        }
      } catch (err) {
        logError('Failed to assign journal to transaction', { id, error: err })
        skipped++
      }
    }

    logInfo('Batch journal assignment completed', {
      total: transactionIds.length,
      assigned,
      skipped
    })

    return { assigned, skipped }
  }

  /**
   * Generate journals for eligible transactions
   */
  async generateJournals(request: GenerateJournalRequestDto): Promise<{
    transaction_ids: string[]
    journal_id: string | null
    total_amount: number
  }> {
    await this.validateCompany(request.company_id)

    if (request.branch_id) {
      await this.validateBranch(request.branch_id)
    }

    const transactions = await this.getUnreconciledTransactions(
      request.company_id,
      request.transaction_date_from || new Date().toISOString().split('T')[0],
      request.transaction_date_to || new Date().toISOString().split('T')[0],
      request.branch_id
    )

    if (transactions.length === 0) {
      return { transaction_ids: [], journal_id: null, total_amount: 0 }
    }

    let filtered = transactions
    if (request.include_unreconciled_only) {
      filtered = transactions.filter(tx => !tx.is_reconciled)
    }
    if (request.payment_method_id) {
      filtered = filtered.filter(tx => tx.payment_method_id === request.payment_method_id)
    }
    if (request.transaction_ids && request.transaction_ids.length > 0) {
      filtered = filtered.filter(tx => request.transaction_ids!.includes(tx.id))
    }

    const totalAmount = filtered.reduce((sum, tx) => sum + Number(tx.net_amount), 0)
    const transactionIds = filtered.map(tx => tx.id)

    logInfo('Generated journals for transactions', {
      company_id: request.company_id,
      transaction_count: transactionIds.length,
      total_amount: totalAmount
    })

    return {
      transaction_ids: transactionIds,
      journal_id: null,
      total_amount: totalAmount
    }
  }

  /**
   * Check source existence (for external use)
   */
  async checkSourceExists(
    sourceType: AggregatedTransactionSourceType,
    sourceId: string,
    sourceRef: string
  ): Promise<boolean> {
    return posAggregatesRepository.sourceExists(sourceType, sourceId, sourceRef)
  }
}

export const posAggregatesService = new PosAggregatesService()
