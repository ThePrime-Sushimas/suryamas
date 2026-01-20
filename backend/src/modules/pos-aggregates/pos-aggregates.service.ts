// backend/src/modules/pos-aggregates/pos-aggregates.service.ts

import { posAggregatesRepository } from './pos-aggregates.repository'
import {
  AggregatedTransaction,
  CreateAggregatedTransactionInput,
  UpdateAggregatedTransactionStatusInput,
} from './pos-aggregates.types'
import {
  PosAggregatesNotFoundError,
  PosAggregatesDuplicateSourceError,
  PosAggregatesVersionConflictError,
  PosAggregatesInvalidStatusTransitionError,
  PosAggregatesInternalError,
} from './pos-aggregates.errors'
import { validateAmountConsistency } from './pos-aggregates.schema'

/**
 * Valid status transitions for aggregated transactions
 */
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  READY: ['JOURNALIZED', 'ERROR', 'SPLIT', 'REFUNDED', 'VOIDED', 'DELETED'],
  JOURNALIZED: ['POSTED', 'ERROR', 'VOIDED'],
  POSTED: ['RECONCILED', 'VOIDED'],
  ERROR: ['READY', 'VOIDED'],
  SPLIT: ['JOURNALIZED', 'POSTED'],
  REFUNDED: ['JOURNALIZED', 'POSTED'],
  VOIDED: [],
  RECONCILED: ['VOIDED'],
  DELETED: [],
}

export class PosAggregatesService {
  /**
   * Create a new aggregated transaction
   */
  async createTransaction(
    input: CreateAggregatedTransactionInput,
    userId?: string
  ): Promise<AggregatedTransaction> {
    // Check for idempotency
    const existing = await posAggregatesRepository.findBySource(
      input.source_type,
      input.source_id,
      input.source_ref
    )
    if (existing) {
      throw new PosAggregatesDuplicateSourceError(
        `${input.source_type}:${input.source_id}:${input.source_ref}`
      )
    }

    // Validate amount consistency
    if (!validateAmountConsistency({
      gross_amount: input.gross_amount,
      discount_amount: input.discount_amount ?? 0,
      tax_amount: input.tax_amount ?? 0,
      service_charge_amount: input.service_charge_amount ?? 0,
      net_amount: input.net_amount,
    })) {
      throw new PosAggregatesInternalError('Amount calculation mismatch')
    }

    return posAggregatesRepository.insert(input, userId)
  }

  /**
   * Batch create aggregated transactions
   */
  async batchCreateTransactions(
    inputs: CreateAggregatedTransactionInput[],
    userId?: string
  ): Promise<AggregatedTransaction[]> {
    // Validate all inputs before batch insert
    for (const input of inputs) {
      if (!validateAmountConsistency({
        gross_amount: input.gross_amount,
        discount_amount: input.discount_amount ?? 0,
        tax_amount: input.tax_amount ?? 0,
        service_charge_amount: input.service_charge_amount ?? 0,
        net_amount: input.net_amount,
      })) {
        throw new PosAggregatesInternalError(
          `Amount calculation mismatch for source: ${input.source_ref}`
        )
      }
    }

    return posAggregatesRepository.batchInsert(inputs, userId)
  }

  /**
   * Get aggregated transaction by ID
   */
  async getTransactionById(id: string): Promise<AggregatedTransaction> {
    const transaction = await posAggregatesRepository.findById(id)
    if (!transaction) {
      throw new PosAggregatesNotFoundError(id)
    }
    return transaction
  }

  /**
   * List transactions by company and date range
   */
  async listTransactions(params: {
    companyId: string
    fromDate: string
    toDate: string
    status?: string
    page?: number
    limit?: number
  }): Promise<{ data: AggregatedTransaction[]; total: number; hasMore: boolean }> {
    return posAggregatesRepository.listByCompanyAndDate({
      companyId: params.companyId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      status: params.status,
      limit: params.limit,
      offset: ((params.page ?? 1) - 1) * (params.limit ?? 50),
    })
  }

  /**
   * Update transaction status with validation
   */
  async updateTransactionStatus(
    id: string,
    newStatus: UpdateAggregatedTransactionStatusInput,
    expectedVersion: number,
    userId?: string
  ): Promise<AggregatedTransaction> {
    const transaction = await posAggregatesRepository.findById(id)
    if (!transaction) {
      throw new PosAggregatesNotFoundError(id)
    }

    // Validate status transition
    if (newStatus.status && newStatus.status !== transaction.status) {
      const validTransitions = VALID_STATUS_TRANSITIONS[transaction.status] ?? []
      if (!validTransitions.includes(newStatus.status)) {
        throw new PosAggregatesInvalidStatusTransitionError(
          transaction.status,
          newStatus.status
        )
      }
    }

    return posAggregatesRepository.updateWithVersion(
      id,
      newStatus,
      expectedVersion,
      userId
    )
  }

  /**
   * Soft delete a transaction
   */
  async deleteTransaction(id: string, userId: string): Promise<void> {
    const transaction = await posAggregatesRepository.findById(id)
    if (!transaction) {
      throw new PosAggregatesNotFoundError(id)
    }

    // Only allow deletion of READY or ERROR status transactions
    if (!['READY', 'ERROR'].includes(transaction.status)) {
      throw new PosAggregatesInvalidStatusTransitionError(
        transaction.status,
        'DELETED'
      )
    }

    await posAggregatesRepository.softDelete(id, userId)
  }

  /**
   * Get child transactions for a split transaction
   */
  async getChildTransactions(parentId: string): Promise<AggregatedTransaction[]> {
    return posAggregatesRepository.findByParentId(parentId)
  }

  /**
   * Find unreconciled transactions for reconciliation
   */
  async findUnreconciled(params: {
    companyId: string
    paymentMethodId: number
    fromDate: string
    toDate: string
  }): Promise<AggregatedTransaction[]> {
    return posAggregatesRepository.findUnreconciled({
      companyId: params.companyId,
      paymentMethodId: params.paymentMethodId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    })
  }
}

export const posAggregatesService = new PosAggregatesService()

