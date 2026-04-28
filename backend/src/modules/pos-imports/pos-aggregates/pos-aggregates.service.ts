import { posAggregatesRepository } from "./pos-aggregates.repository";
import { paymentMethodsRepository } from "../../payment-methods/payment-methods.repository";
import { branchesRepository } from "../../branches/branches.repository";
import { AuditService } from "../../monitoring/monitoring.service";
import {
  AggregatedTransaction,
  AggregatedTransactionWithDetails,
  AggregatedTransactionFilterParams,
  AggregatedTransactionSortParams,
  AggregatedTransactionStatus,
  AggregatedTransactionSourceType,
  CreateAggregatedTransactionDto,
  UpdateAggregatedTransactionDto,
  AggregatedTransactionSummary,
  AggregatedTransactionBatchResult,
} from "./pos-aggregates.types";
import { AggregatedTransactionErrors } from "./pos-aggregates.errors";
import {
  getPaginationParams,
  createPaginatedResponse,
} from "../../../utils/pagination.util";
import { logInfo, logError } from "../../../config/logger";

export class PosAggregatesService {
  /**
   * Validate that branch exists (if provided)
   */
  private async validateBranch(branchId: string | null): Promise<void> {
    if (!branchId) return;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);

    const branch = isUuid 
      ? await branchesRepository.findById(branchId)
      : await branchesRepository.findByName(branchId);

    if (!branch) throw AggregatedTransactionErrors.BRANCH_NOT_FOUND(branchId);
    if (branch.status !== "active") {
      throw AggregatedTransactionErrors.BRANCH_INACTIVE(branchId);
    }
  }

  /**
   * Find branch by name
   */
  private async findBranchByName(
    branchName: string,
  ): Promise<{ id: string; branch_name: string } | null> {
    const branch = await branchesRepository.findByName(branchName);
    return branch ? { id: branch.id, branch_name: branch.branch_name } : null;
  }

  /**
   * Find branch by ID
   */
  private async findBranchById(
    branchId: string,
  ): Promise<{ id: string; branch_name: string } | null> {
    const branch = await branchesRepository.findById(branchId);
    return branch ? { id: branch.id, branch_name: branch.branch_name } : null;
  }

  /**
   * Resolve branch_id and branch_name
   */
  private async resolveBranch(
    branchId?: string | null,
    branchName?: string | null,
  ): Promise<{ branch_id: string | null; branch_name: string | null }> {
    if (!branchId && !branchName) {
      return { branch_id: null, branch_name: null };
    }

    if (branchId) {
      const branch = await this.findBranchById(branchId);
      return {
        branch_id: branchId,
        branch_name: branch?.branch_name ?? null,
      };
    }

    if (branchName) {
      const branch = await this.findBranchByName(branchName);
      return {
        branch_id: branch?.id ?? null,
        branch_name: branchName,
      };
    }

    return { branch_id: null, branch_name: null };
  }

  /**
   * Validate that payment method exists and is active
   */
  private async validatePaymentMethod(
    paymentMethodId: number | string,
  ): Promise<number> {
    const pm = typeof paymentMethodId === "number"
      ? await paymentMethodsRepository.findById(paymentMethodId)
      : await paymentMethodsRepository.findByName(paymentMethodId);

    if (!pm) throw AggregatedTransactionErrors.PAYMENT_METHOD_NOT_FOUND(paymentMethodId.toString());
    if (!pm.is_active) {
      throw AggregatedTransactionErrors.PAYMENT_METHOD_INACTIVE(paymentMethodId.toString());
    }

    return pm.id;
  }

  /**
   * Resolve payment method ID
   */
  private async resolvePaymentMethodId(
    paymentMethodId: number | string,
  ): Promise<number> {
    return this.validatePaymentMethod(paymentMethodId);
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: AggregatedTransactionStatus,
    newStatus: AggregatedTransactionStatus,
  ): void {
    const validTransitions: Record<
      AggregatedTransactionStatus,
      AggregatedTransactionStatus[]
    > = {
      READY: ["PENDING", "CANCELLED"],
      PENDING: ["PROCESSING", "CANCELLED"],
      PROCESSING: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
      FAILED: ["READY", "CANCELLED"],
      VOID: [],
      SUPERSEDED: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw AggregatedTransactionErrors.INVALID_STATUS_TRANSITION(
        currentStatus,
        newStatus,
      );
    }
  }

  /**
   * Convert CreateDto to Repository insert format
   */
  private toInsertData(
    data: Omit<CreateAggregatedTransactionDto, "payment_method_id">,
    paymentMethodId: number,
    feeConfig?: {
      fee_percentage: number
      fee_fixed_amount: number
      fee_fixed_per_transaction: boolean
    },
  ): Omit<
    AggregatedTransaction,
    "id" | "created_at" | "updated_at" | "version"
  > {
    const billAfterDiscount =
      Number(data.gross_amount) +
      Number(data.tax_amount ?? 0) +
      Number(data.service_charge_amount ?? 0) +
      Number(data.other_vat_amount ?? 0) +
      Number(data.delivery_cost ?? 0) +
      Number(data.order_fee ?? 0) -
      Number(data.discount_amount ?? 0) -
      Number(data.promotion_discount_amount ?? 0) -
      Number(data.voucher_discount_amount ?? 0) +
      Number(data.rounding_amount ?? 0)

    const percentageFeeAmount =
      feeConfig && feeConfig.fee_percentage > 0
        ? billAfterDiscount * (feeConfig.fee_percentage / 100)
        : Number(data.percentage_fee_amount ?? 0)

    const fixedFeeAmount =
      feeConfig && feeConfig.fee_fixed_amount > 0
        ? feeConfig.fee_fixed_amount
        : Number(data.fixed_fee_amount ?? 0)

    const totalFeeAmount = percentageFeeAmount + fixedFeeAmount
    const nettAmount = billAfterDiscount - totalFeeAmount

    return {
      branch_id: data.branch_id ?? null,
      branch_name: data.branch_name ?? null,
      source_type: data.source_type,
      source_id: data.source_id,
      source_ref: data.source_ref,
      transaction_date: data.transaction_date,
      payment_method_id: paymentMethodId,
      gross_amount: data.gross_amount,
      discount_amount: data.discount_amount ?? 0,
      tax_amount: data.tax_amount ?? 0,
      service_charge_amount: data.service_charge_amount ?? 0,
      bill_after_discount: billAfterDiscount,
      percentage_fee_amount: percentageFeeAmount,
      fixed_fee_amount: fixedFeeAmount,
      total_fee_amount: totalFeeAmount,
      nett_amount: nettAmount,
      rounding_amount: data.rounding_amount ?? 0,
      delivery_cost: data.delivery_cost ?? 0,
      order_fee: data.order_fee ?? 0,
      voucher_discount_amount: data.voucher_discount_amount ?? 0,
      promotion_discount_amount: data.promotion_discount_amount ?? 0,
      menu_discount_amount: 0,
      voucher_payment_amount: 0,
      other_vat_amount: data.other_vat_amount ?? 0,
      pax_total: 0,
      currency: data.currency ?? "IDR",
      journal_id: null,
      is_reconciled: false,
      status: data.status ?? "READY",
      deleted_at: null,
      deleted_by: null,
      failed_at: null,
      failed_reason: null,
    };
  }

  /**
   * Get payment method with fee configuration
   */
  private async getPaymentMethodFeeConfig(
    paymentMethodId: number,
  ): Promise<{
    fee_percentage: number
    fee_fixed_amount: number
    fee_fixed_per_transaction: boolean
  } | null> {
    try {
      const paymentMethod = await paymentMethodsRepository.findById(paymentMethodId)
      if (!paymentMethod) {
        logInfo("Payment method not found for fee calculation", { payment_method_id: paymentMethodId })
        return null
      }

      return {
        fee_percentage: paymentMethod.fee_percentage ?? 0,
        fee_fixed_amount: paymentMethod.fee_fixed_amount ?? 0,
        fee_fixed_per_transaction: paymentMethod.fee_fixed_per_transaction ?? false,
      }
    } catch (error) {
      logError("Failed to get payment method fee config", {
        payment_method_id: paymentMethodId,
        error: (error as Error).message,
      })
      return null
    }
  }

  /**
   * Create new aggregated transaction
   */
  async createTransaction(
    data: CreateAggregatedTransactionDto,
    skipPaymentMethodValidation = false,
  ): Promise<AggregatedTransaction> {
    const resolvedBranch = await this.resolveBranch(data.branch_id, data.branch_name)

    let resolvedPaymentMethodId: number;
    if (data.payment_method_id === null) {
      throw new Error('payment_method_id required');
    }

    if (skipPaymentMethodValidation && typeof data.payment_method_id === 'number') {
      resolvedPaymentMethodId = data.payment_method_id;
    } else {
      resolvedPaymentMethodId = await this.resolvePaymentMethodId(data.payment_method_id);
    }

    const exists = await posAggregatesRepository.sourceExists(
      data.source_type,
      data.source_id,
      data.source_ref,
    );

    if (exists) {
      throw AggregatedTransactionErrors.DUPLICATE_SOURCE();
    }

    const feeConfig = await this.getPaymentMethodFeeConfig(resolvedPaymentMethodId);

    const { payment_method_id, branch_id, branch_name, ...dataWithoutPaymentMethod } = data;

    const insertData = this.toInsertData(
      {
        ...dataWithoutPaymentMethod,
        branch_id: resolvedBranch.branch_id,
        branch_name: resolvedBranch.branch_name,
      },
      resolvedPaymentMethodId,
      feeConfig ?? undefined,
    );
    
    const created = await posAggregatesRepository.create(insertData);

    if (insertData.source_type === 'POS' && (insertData.branch_id || insertData.branch_name) && resolvedPaymentMethodId) {
      const existingPosSync = await posAggregatesRepository.findExistingSync({
        transaction_date: insertData.transaction_date,
        payment_method_id: resolvedPaymentMethodId,
        branch_id: insertData.branch_id,
        branch_name: insertData.branch_name
      });

      if (existingPosSync) {
        await posAggregatesRepository.setSuperseded(created.id, existingPosSync.id);

        logInfo('Manual CSV auto-superseded by existing POS_SYNC', {
          manual_id: created.id,
          pos_sync_id: existingPosSync.id,
          date: insertData.transaction_date,
          branch_id: insertData.branch_id,
          payment_method_id: resolvedPaymentMethodId,
        });
      }
    }

    const userId = (data as any).userId;
    if (userId) {
      await AuditService.log('CREATE', 'aggregated_transaction', created.id, userId, undefined, {
        source_type: created.source_type,
        source_id: created.source_id,
        source_ref: created.source_ref,
        gross_amount: created.gross_amount,
        payment_method_id: created.payment_method_id,
        status: created.status,
      });
    }

    return created;
  }

  /**
   * Create multiple transactions (batch)
   */
  async createBatch(
    transactions: CreateAggregatedTransactionDto[],
  ): Promise<AggregatedTransactionBatchResult> {
    const results: AggregatedTransactionBatchResult = {
      success: [],
      failed: [],
      total_processed: transactions.length,
    };

    for (const tx of transactions) {
      try {
        await this.createTransaction(tx);
        results.success.push(tx.source_ref);
      } catch (err) {
        results.failed.push({
          source_ref: tx.source_ref,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        logError("Failed to create transaction in batch", {
          source_ref: tx.source_ref,
          error: err,
        });
      }
    }

    logInfo("Batch transaction creation completed", {
      total: transactions.length,
      success: results.success.length,
      failed: results.failed.length,
    });

    return results;
  }

  /**
   * Get single transaction by ID
   */
  async getTransactionById(
    id: string,
  ): Promise<AggregatedTransactionWithDetails> {
    const transaction = await posAggregatesRepository.findById(id);
    if (!transaction) {
      throw AggregatedTransactionErrors.NOT_FOUND(id);
    }
    return transaction;
  }

  /**
   * Get transactions with pagination and filters
   */
  async getTransactions(
    filter?: AggregatedTransactionFilterParams,
    sort?: AggregatedTransactionSortParams,
  ) {
    const { page, limit, offset } = getPaginationParams(filter as any);
    const { data, total } = await posAggregatesRepository.findAll(
      { limit, offset },
      filter,
      sort,
    );

    return createPaginatedResponse(data, total, page, limit);
  }

  /**
   * Update transaction
   */
  async updateTransaction(
    id: string,
    updates: UpdateAggregatedTransactionDto,
    expectedVersion?: number,
  ): Promise<AggregatedTransaction> {
    const existing = await posAggregatesRepository.findById(id);
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id);
    }

    if (updates.status && updates.status !== existing.status) {
      this.validateStatusTransition(existing.status, updates.status);
    }

    type ResolvedUpdateData = Omit<
      UpdateAggregatedTransactionDto,
      "payment_method_id"
    > & { payment_method_id?: number };

    const resolvedUpdates: ResolvedUpdateData = {
      branch_id: updates.branch_id,
      branch_name: updates.branch_name,
      source_type: updates.source_type,
      source_id: updates.source_id,
      source_ref: updates.source_ref,
      transaction_date: updates.transaction_date,
      gross_amount: updates.gross_amount,
      discount_amount: updates.discount_amount,
      tax_amount: updates.tax_amount,
      service_charge_amount: updates.service_charge_amount,
      bill_after_discount: updates.bill_after_discount,
      percentage_fee_amount: updates.percentage_fee_amount,
      fixed_fee_amount: updates.fixed_fee_amount,
      total_fee_amount: updates.total_fee_amount,
      nett_amount: updates.nett_amount,
      currency: updates.currency,
      status: updates.status,
      is_reconciled: updates.is_reconciled,
      version: updates.version,
      payment_method_id:
        typeof updates.payment_method_id === "number"
          ? updates.payment_method_id
          : undefined,
    };

    if (updates.payment_method_id !== undefined) {
      if (typeof updates.payment_method_id === "string") {
        const resolvedId = await this.resolvePaymentMethodId(updates.payment_method_id);
        resolvedUpdates.payment_method_id = resolvedId;
      }
    }

    if (updates.branch_id !== undefined || updates.branch_name !== undefined) {
      const resolvedBranch = await this.resolveBranch(updates.branch_id, updates.branch_name);
      resolvedUpdates.branch_id = resolvedBranch.branch_id;
      resolvedUpdates.branch_name = resolvedBranch.branch_name;
    }

    logInfo("Updating aggregated transaction", {
      id,
      expected_version: expectedVersion,
      updates: Object.keys(resolvedUpdates),
    });

    try {
      const updated = await posAggregatesRepository.update(
        id,
        resolvedUpdates as Partial<AggregatedTransaction>,
        expectedVersion,
      );

      const userId = (updates as any).userId;
      if (userId) {
        await AuditService.log('UPDATE', 'aggregated_transaction', id, userId, existing, updated);
      }

      return updated;
    } catch (err: any) {
      if (err.message?.includes("version") || err.code === "P0001") {
        throw AggregatedTransactionErrors.VERSION_CONFLICT(
          id,
          expectedVersion || existing.version,
          (expectedVersion || existing.version) + 1,
        );
      }
      throw err;
    }
  }

  /**
   * Soft delete transaction
   */
  async deleteTransaction(id: string, deletedBy?: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id);
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id);
    }

    if (existing.status === "COMPLETED") {
      throw AggregatedTransactionErrors.CANNOT_DELETE_COMPLETED(id);
    }

    logInfo("Deleting aggregated transaction", {
      id,
      status: existing.status,
      deleted_by: deletedBy,
    });

    await posAggregatesRepository.softDelete(id, deletedBy);

    if (deletedBy) {
      await AuditService.log('DELETE', 'aggregated_transaction', id, deletedBy, existing, null);
    }
  }

  /**
   * Restore soft-deleted transaction
   */
  async restoreTransaction(id: string, restoredBy?: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id);
    if (existing && !existing.deleted_at) {
      throw AggregatedTransactionErrors.ALREADY_ACTIVE(id);
    }

    logInfo("Restoring aggregated transaction", { id });
    await posAggregatesRepository.restore(id);

    if (restoredBy) {
      await AuditService.log('RESTORE', 'aggregated_transaction', id, restoredBy, null, existing);
    }
  }

  /**
   * Mark transaction as reconciled
   */
  async reconcileTransaction(id: string, reconciledBy: string, reason?: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id);
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id);
    }

    if (existing.is_reconciled) {
      throw AggregatedTransactionErrors.ALREADY_RECONCILED(id);
    }

    logInfo("Reconciling transaction", { id, reconciled_by: reconciledBy, reason });
    await posAggregatesRepository.markReconciled([id], reconciledBy);

    if (reason) {
      await posAggregatesRepository.updateNote(id, reason);
    }

    if (reconciledBy) {
      await AuditService.log('RECONCILE', 'aggregated_transaction', id, reconciledBy, { is_reconciled: false }, { is_reconciled: true, reason });
    }
  }

  /**
   * Batch reconcile transactions
   */
  async reconcileBatch(
    transactionIds: string[],
    reconciledBy: string,
  ): Promise<number> {
    let reconciled = 0;

    for (const id of transactionIds) {
      try {
        const existing = await posAggregatesRepository.findById(id);
        if (existing && !existing.is_reconciled) {
          await posAggregatesRepository.markReconciled([id], reconciledBy);
          reconciled++;
        }
      } catch (err) {
        logError("Failed to reconcile transaction", { id, error: err });
      }
    }

    logInfo("Batch reconciliation completed", {
      total: transactionIds.length,
      reconciled,
    });

    return reconciled;
  }

  /**
   * Get summary statistics
   */
  async getSummary(
    dateFrom?: string,
    dateTo?: string,
    branchNames?: string[],
    paymentMethodIds?: number[],
    status?: string,
    isReconciled?: boolean,
  ): Promise<AggregatedTransactionSummary> {
    const summary = await posAggregatesRepository.getSummary(
      dateFrom,
      dateTo,
      branchNames,
      paymentMethodIds,
      status,
      isReconciled,
    );

    const statusCounts = await posAggregatesRepository.getStatusCounts(
      dateFrom,
      dateTo,
      branchNames,
      paymentMethodIds,
    );

    return {
      ...summary,
      by_status: statusCounts,
    };
  }

  /**
   * Get unreconciled transactions for journal generation
   */
  async getUnreconciledTransactions(
    dateFrom?: string,
    dateTo?: string,
    branchName?: string,
  ): Promise<AggregatedTransaction[]> {
    return posAggregatesRepository.findUnreconciled(
      dateFrom,
      dateTo,
      branchName,
    );
  }

  /**
   * Assign journal to transaction
   */
  async assignJournal(id: string, journalId: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id);
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id);
    }

    if (existing.journal_id) {
      throw AggregatedTransactionErrors.JOURNAL_ALREADY_ASSIGNED(id);
    }

    logInfo("Assigning journal to transaction", { id, journal_id: journalId });
    await posAggregatesRepository.assignJournal(id, journalId);
  }

  /**
   * Assign journal to multiple transactions (batch)
   */
  async assignJournalBatch(
    transactionIds: string[],
    journalId: string,
  ): Promise<{ assigned: number; skipped: number }> {
    let assigned = 0;
    let skipped = 0;

    for (const id of transactionIds) {
      try {
        const existing = await posAggregatesRepository.findById(id);
        if (existing && !existing.journal_id) {
          await posAggregatesRepository.assignJournal(id, journalId);
          assigned++;
        } else {
          skipped++;
        }
      } catch (err) {
        logError("Failed to assign journal to transaction", { id, error: err });
        skipped++;
      }
    }

    logInfo("Batch journal assignment completed", {
      total: transactionIds.length,
      assigned,
      skipped,
    });

    return { assigned, skipped };
  }

  /**
   * Check source existence
   */
  async checkSourceExists(
    sourceType: AggregatedTransactionSourceType,
    sourceId: string,
    sourceRef: string,
  ): Promise<boolean> {
    return posAggregatesRepository.sourceExists(
      sourceType,
      sourceId,
      sourceRef,
    );
  }

  /**
   * Get payment method ID by name
   */
  private async getPaymentMethodId(
    paymentMethodName: string,
    companyId?: string,
  ): Promise<{ id: number; isFallback: boolean }> {
    if (!paymentMethodName || typeof paymentMethodName !== "string") {
      return { id: 20, isFallback: true };
    }

    const trimmedName = paymentMethodName.trim();
    const pm = await paymentMethodsRepository.findByName(trimmedName, companyId);

    if (pm) {
      return { id: pm.id, isFallback: false };
    }

    // Try global search if company search failed
    if (companyId) {
      const globalPm = await paymentMethodsRepository.findByName(trimmedName);
      if (globalPm) {
        return { id: globalPm.id, isFallback: true };
      }
    }

    return { id: 20, isFallback: true };
  }

  /**
   * Get all failed transactions
   */
  async getFailedTransactions(
    filter?: AggregatedTransactionFilterParams,
    sort?: AggregatedTransactionSortParams,
  ) {
    const { page, limit, offset } = getPaginationParams(filter as any);

    const failedFilter: AggregatedTransactionFilterParams = {
      ...filter,
      status: "FAILED",
    };

    const { data, total } = await posAggregatesRepository.findAll(
      { limit, offset },
      failedFilter,
      sort,
    );

    return createPaginatedResponse(data, total, page, limit);
  }

  /**
   * Get failed transaction by ID
   */
  async getFailedTransactionById(
    id: string,
  ): Promise<AggregatedTransactionWithDetails> {
    const transaction = await posAggregatesRepository.findById(id);
    if (!transaction) {
      throw AggregatedTransactionErrors.NOT_FOUND(id);
    }
    if (transaction.status !== "FAILED") {
      throw new Error("Transaction is not in FAILED status");
    }
    return transaction;
  }

  /**
   * Fix and retry a failed transaction
   */
  async fixFailedTransaction(
    id: string,
    updates: UpdateAggregatedTransactionDto,
  ): Promise<AggregatedTransaction> {
    const existing = await posAggregatesRepository.findById(id);
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id);
    }
    if (existing.status !== "FAILED") {
      throw new Error("Only FAILED transactions can be fixed");
    }

    if (typeof updates.payment_method_id === "string") {
      const resolvedId = await this.resolvePaymentMethodId(updates.payment_method_id);
      (updates as any).payment_method_id = resolvedId;
    }

    const fixData: any = {
      ...updates,
      status: "READY" as AggregatedTransactionStatus,
    };

    try {
      const updated = await posAggregatesRepository.update(
        id,
        fixData,
        existing.version,
      );

      const userId = (updates as any).userId;
      if (userId) {
        await AuditService.log('FIX_FAILED', 'aggregated_transaction', id, userId, { status: 'FAILED', failed_reason: existing.failed_reason }, { status: 'READY' });
      }

      return updated;
    } catch (err: any) {
      logError("Failed to fix transaction", { id, error: err });
      throw err;
    }
  }

  /**
   * Batch fix failed transactions
   */
  async batchFixFailedTransactions(
    ids: string[],
    updates: UpdateAggregatedTransactionDto,
  ): Promise<{
    fixed: string[];
    failed: Array<{ id: string; error: string }>;
  }> {
    const results = {
      fixed: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    };

    for (const id of ids) {
      try {
        await this.fixFailedTransaction(id, updates);
        results.fixed.push(id);
      } catch (err) {
        results.failed.push({
          id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Delete a failed transaction permanently
   */
  async deleteFailedTransaction(id: string, deletedBy?: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id);
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id);
    }
    if (existing.status !== "FAILED") {
      throw new Error("Only FAILED transactions can be deleted");
    }

    await posAggregatesRepository.hardDelete(id);

    if (deletedBy) {
      await AuditService.log('DELETE', 'aggregated_transaction', id, deletedBy, existing, null);
    }
  }

  /**
   * Recalculate fee for POS Import records by date
   */
  async recalculateFeeByDate(
    transactionDate: string,
    userId?: string,
  ): Promise<{ updated: number; skipped: number; errors: string[] }> {
    const records = await posAggregatesRepository.findForFeeRecalculation(transactionDate);
    if (!records || records.length === 0) return { updated: 0, skipped: 0, errors: [] }

    const pmIds = [...new Set(records.map(r => r.payment_method_id).filter(Boolean))] as number[]
    const feeMap = new Map<number, { fee_percentage: number; fee_fixed_amount: number; fee_fixed_per_transaction: boolean }>()

    if (pmIds.length > 0) {
      const pms = await paymentMethodsRepository.findByIds(pmIds);
      for (const pm of pms) {
        feeMap.set(pm.id, {
          fee_percentage: Number(pm.fee_percentage ?? 0),
          fee_fixed_amount: Number(pm.fee_fixed_amount ?? 0),
          fee_fixed_per_transaction: pm.fee_fixed_per_transaction ?? false,
        })
      }
    }

    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const record of records) {
      if (record.is_reconciled) {
        skipped++
        continue
      }

      const fee = record.payment_method_id ? feeMap.get(record.payment_method_id) : null
      if (!fee) {
        skipped++
        continue
      }

      const billAfterDiscount = Number(record.bill_after_discount || record.gross_amount || 0)
      const percentageFee = billAfterDiscount * (fee.fee_percentage / 100)
      const fixedFee = fee.fee_fixed_amount
      const totalFee = percentageFee + fixedFee
      const nettAmount = billAfterDiscount - totalFee

      try {
        await posAggregatesRepository.updateFee(record.id, {
          percentage_fee_amount: percentageFee,
          fixed_fee_amount: fixedFee,
          total_fee_amount: totalFee,
          nett_amount: nettAmount,
        })
        updated++
      } catch (err: any) {
        errors.push(`${record.id}: ${err.message}`)
      }
    }

    if (userId && updated > 0) {
      await AuditService.log('UPDATE', 'aggregated_transaction', transactionDate, userId,
        null, { action: 'recalculate_fee', date: transactionDate, updated, skipped })
    }

    return { updated, skipped, errors }
  }
}

export const posAggregatesService = new PosAggregatesService();
