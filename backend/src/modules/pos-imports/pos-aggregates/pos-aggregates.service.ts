import { supabase } from "../../../config/supabase";
import { posAggregatesRepository } from "./pos-aggregates.repository";
import { paymentMethodsRepository } from "../../payment-methods/payment-methods.repository";
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
import { feeCalculationService } from "../../reconciliation/fee-reconciliation/fee-calculation.service";

export class PosAggregatesService {
  /**
   * Validate that branch exists (if provided)
   * Note: branchId can be either UUID (id) or branch name (string)
   * Uses case-insensitive search for branch names
   */
  private async validateBranch(branchId: string | null): Promise<void> {
    if (!branchId) return;

    // Check if branchId is a valid UUID (5fdd0a7b-etc format)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        branchId,
      );

    let query = supabase.from("branches").select("id, status, branch_name");

    if (isUuid) {
      // Query by UUID id
      query = query.eq("id", branchId);
    } else {
      // Query by branch_name (string) - use ilike for case-insensitive search
      query = query.ilike("branch_name", branchId.trim());
    }

    const { data, error } = await query.maybeSingle();

    if (error)
      throw AggregatedTransactionErrors.DATABASE_ERROR(
        "Failed to validate branch",
        error,
      );
    if (!data) throw AggregatedTransactionErrors.BRANCH_NOT_FOUND(branchId);
    if ((data as any).status !== "active") {
      throw AggregatedTransactionErrors.BRANCH_INACTIVE(branchId);
    }
  }

  /**
   * Find branch by name
   * Note: Uses case-insensitive search to handle differences in branch name capitalization
   */
  private async findBranchByName(
    branchName: string,
  ): Promise<{ id: string; branch_name: string } | null> {
    // Normalize branch name: trim + collapse multiple spaces to single space
    const normalizedBranchName = branchName.trim().replace(/\s+/g, " ");

    // Try exact match first (case-insensitive via ilike)
    const { data, error } = await supabase
      .from("branches")
      .select("id, branch_name")
      .ilike("branch_name", normalizedBranchName)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      logError("Failed to find branch by name", {
        branch_name: branchName,
        normalized_name: normalizedBranchName,
        error,
      });
      throw AggregatedTransactionErrors.DATABASE_ERROR(
        "Failed to find branch by name",
        error,
      );
    }

    logInfo("Branch lookup result", {
      original_name: branchName,
      normalized_name: normalizedBranchName,
      found: !!data,
      branch_name: data?.id,
    });

    return data;
  }

  /**
   * Validate that payment method exists and is active
   * Accepts either numeric ID or string name
   */
  private async validatePaymentMethod(
    paymentMethodId: number | string,
  ): Promise<number> {
    let query = supabase.from("payment_methods").select("id, is_active");

    // If it's a number, search by ID; if string, search by name (case-insensitive)
    if (typeof paymentMethodId === "number") {
      query = query.eq("id", paymentMethodId);
    } else {
      query = query.ilike("name", paymentMethodId.trim());
    }

    const { data, error } = await query.maybeSingle();

    if (error)
      throw AggregatedTransactionErrors.DATABASE_ERROR(
        "Failed to validate payment method",
        error,
      );
    if (!data)
      throw AggregatedTransactionErrors.PAYMENT_METHOD_NOT_FOUND(
        paymentMethodId.toString(),
      );
    if (!(data as any).is_active) {
      throw AggregatedTransactionErrors.PAYMENT_METHOD_INACTIVE(
        paymentMethodId.toString(),
      );
    }

    return data.id;
  }

  /**
   * Resolve payment method ID from either number ID or string name
   * Returns the actual numeric ID
   */
  private async resolvePaymentMethodId(
    paymentMethodId: number | string,
  ): Promise<number> {
    // If already a number, validate it exists
    if (typeof paymentMethodId === "number") {
      return this.validatePaymentMethod(paymentMethodId);
    }
    // If string, look up by name and return the ID
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
      FAILED: ["READY", "CANCELLED"], // FAILED can be retried or cancelled
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
   * Note: paymentMethodId is the resolved numeric ID (already converted from name if needed)
   * Also calculates fee from payment method configuration
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
    // Calculate bill after discount = gross + tax - discount
    const billAfterDiscount =
      Number(data.gross_amount) +
      Number(data.tax_amount ?? 0) -
      Number(data.discount_amount ?? 0)

    // Calculate fee from payment method configuration
    // percentage_fee = bill_after_discount × fee_percentage / 100
    const percentageFeeAmount =
      feeConfig && feeConfig.fee_percentage > 0
        ? billAfterDiscount * (feeConfig.fee_percentage / 100)
        : Number(data.percentage_fee_amount ?? 0)

    // fixed_fee = fee_fixed_amount (per transaction)
    const fixedFeeAmount =
      feeConfig && feeConfig.fee_fixed_amount > 0
        ? feeConfig.fee_fixed_amount
        : Number(data.fixed_fee_amount ?? 0)

    // total_fee = percentage_fee + fixed_fee
    const totalFeeAmount = percentageFeeAmount + fixedFeeAmount

// nett_amount = bill_after_discount - total_fee
    const nettAmount = billAfterDiscount - totalFeeAmount

    return {
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
   * Looks up payment method by ID and returns fee config
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
        fee_percentage: (paymentMethod as any).fee_percentage ?? 0,
        fee_fixed_amount: (paymentMethod as any).fee_fixed_amount ?? 0,
        fee_fixed_per_transaction: (paymentMethod as any).fee_fixed_per_transaction ?? false,
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
   * Automatically calculates fee from payment method configuration
   */
  async createTransaction(
    data: CreateAggregatedTransactionDto,
    skipPaymentMethodValidation = false,
  ): Promise<AggregatedTransaction> {
    // Skip branch validation for POS imports - store branch_name directly
    // Branch validation only needed when using branch_id (UUID)
    // await this.validateBranch(data.branch_name ?? null)

    // Resolve payment method ID (handles both number ID and string name)
    let resolvedPaymentMethodId: number;
    if (skipPaymentMethodValidation) {
      // If skipping validation, still try to resolve the ID
      if (typeof data.payment_method_id === "number") {
        resolvedPaymentMethodId = data.payment_method_id;
      } else {
        resolvedPaymentMethodId = await this.resolvePaymentMethodId(
          data.payment_method_id,
        );
      }
    } else {
      resolvedPaymentMethodId = await this.resolvePaymentMethodId(
        data.payment_method_id,
      );
    }

    const exists = await posAggregatesRepository.sourceExists(
      data.source_type,
      data.source_id,
      data.source_ref,
    );

    if (exists) {
      throw AggregatedTransactionErrors.DUPLICATE_SOURCE(
        data.source_type,
        data.source_id,
        data.source_ref,
      );
    }

    // Get fee configuration from payment method
    const feeConfig = await this.getPaymentMethodFeeConfig(resolvedPaymentMethodId);

    logInfo("Creating aggregated transaction with fee calculation", {
      source_type: data.source_type,
      source_id: data.source_id,
      source_ref: data.source_ref,
      payment_method_id: resolvedPaymentMethodId,
      fee_percentage: feeConfig?.fee_percentage ?? 0,
      fee_fixed_amount: feeConfig?.fee_fixed_amount ?? 0,
    });

    // Create a modified data object without payment_method_id (will be passed separately)
    const { payment_method_id, ...dataWithoutPaymentMethod } = data;

    const insertData = this.toInsertData(
      dataWithoutPaymentMethod,
      resolvedPaymentMethodId,
      feeConfig ?? undefined,
    );
    return posAggregatesRepository.create(insertData);
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

    // Resolve payment method ID if provided as string
    // We need to create a new object with the resolved payment method ID
    // to avoid type conflicts between UpdateAggregatedTransactionDto and Partial<AggregatedTransaction>
    // Use type assertion to handle the spread operator type preservation issue
    type ResolvedUpdateData = Omit<
      UpdateAggregatedTransactionDto,
      "payment_method_id"
    > & { payment_method_id?: number };
    const resolvedUpdates: ResolvedUpdateData = {
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
        const resolvedId = await this.resolvePaymentMethodId(
          updates.payment_method_id,
        );
        resolvedUpdates.payment_method_id = resolvedId;
      }
      // If it's a number, it's already set above
    }

    if (updates.branch_name !== undefined) {
      await this.validateBranch(updates.branch_name);
    }

    logInfo("Updating aggregated transaction", {
      id,
      expected_version: expectedVersion,
      updates: Object.keys(resolvedUpdates),
    });

    try {
      return await posAggregatesRepository.update(
        id,
        resolvedUpdates,
        expectedVersion,
      );
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
  }

  /**
   * Restore soft-deleted transaction
   */
  async restoreTransaction(id: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id);
    if (existing && !existing.deleted_at) {
      throw AggregatedTransactionErrors.ALREADY_ACTIVE(id);
    }

    logInfo("Restoring aggregated transaction", { id });
    await posAggregatesRepository.restore(id);
  }

  /**
   * Mark transaction as reconciled
   */
  async reconcileTransaction(id: string, reconciledBy: string): Promise<void> {
    const existing = await posAggregatesRepository.findById(id);
    if (!existing) {
      throw AggregatedTransactionErrors.NOT_FOUND(id);
    }

    if (existing.is_reconciled) {
      throw AggregatedTransactionErrors.ALREADY_RECONCILED(id);
    }

    if (!existing.journal_id) {
      throw AggregatedTransactionErrors.NO_JOURNAL_ASSIGNED(id);
    }

    logInfo("Reconciling transaction", { id, reconciled_by: reconciledBy });
    await posAggregatesRepository.markReconciled([id], reconciledBy);
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
        if (existing && !existing.is_reconciled && existing.journal_id) {
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
  ): Promise<AggregatedTransactionSummary> {
    const summary = await posAggregatesRepository.getSummary(
      dateFrom,
      dateTo,
      branchNames,
    );

    // Pass filters to getStatusCounts so counts match filtered data
    const statusCounts = await posAggregatesRepository.getStatusCounts(
      dateFrom,
      dateTo,
      branchNames,
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

  // batas pindah generateJournalPerDate

  /**
   * Check source existence (for external use)
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
   * Get payment method ID by name (helper method)
   * Note: Global search with company_id filter to handle duplicate names across companies
   */
  private async getPaymentMethodId(
    paymentMethodName: string,
    companyId?: string,
  ): Promise<{ id: number; isFallback: boolean }> {
    // Log the raw input
    logInfo("getPaymentMethodId: Starting lookup", {
      raw_input: paymentMethodName,
      input_type: typeof paymentMethodName,
      input_length: paymentMethodName?.length,
      input_trimmed: paymentMethodName?.trim(),
      company_id: companyId,
    });

    // Validate input
    if (!paymentMethodName || typeof paymentMethodName !== "string") {
      logError("getPaymentMethodId: Invalid input", {
        payment_method_name: paymentMethodName,
        input_type: typeof paymentMethodName,
      });
      return { id: 20, isFallback: true };
    }

    const trimmedName = paymentMethodName.trim();

    // Try to find payment method with company_id filter if provided
    logInfo("getPaymentMethodId: Executing database query", {
      query_name: trimmedName,
      query_ilike: true,
      is_active_filter: true,
      company_id_filter: companyId || "none (global search)",
    });

    let query = supabase
      .from("payment_methods")
      .select("id, name, code, is_active, coa_account_id, company_id")
      .ilike("name", trimmedName)
      .eq("is_active", true);

    // Add company_id filter if provided to avoid duplicate name issues
    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    // Log raw database response
    logInfo("getPaymentMethodId: Database query result", {
      query_name: trimmedName,
      data_found: !!data,
      error_occurred: !!error,
      error_message: error?.message,
      error_details: error,
      returned_data: data,
      company_filter_applied: !!companyId,
    });

    if (error) {
      logError("getPaymentMethodId: Database error", {
        name: trimmedName,
        error_code: error.code,
        error_message: error.message,
        error_details: error,
      });
      logInfo("getPaymentMethodId: Using fallback due to database error", {
        requested: trimmedName,
        fallback_reason: "database_error",
        default_id: 20,
      });
      return { id: 20, isFallback: true };
    }

    if (data) {
      logInfo("getPaymentMethodId: Found payment method", {
        requested: trimmedName,
        found_id: data.id,
        found_name: data.name,
        found_code: data.code,
        found_is_active: data.is_active,
        found_coa_account_id: data.coa_account_id,
        found_company_id: data.company_id,
        is_fallback: false,
      });
      return { id: data.id, isFallback: false };
    }

    // If not found with company filter, try global search (for backward compatibility)
    if (companyId) {
      logInfo(
        "getPaymentMethodId: Not found with company filter, trying global search",
        {
          requested: trimmedName,
          company_id: companyId,
        },
      );

      const { data: globalData, error: globalError } = await supabase
        .from("payment_methods")
        .select("id, name, code, is_active, coa_account_id, company_id")
        .ilike("name", trimmedName)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!globalError && globalData) {
        logInfo("getPaymentMethodId: Found in global search", {
          requested: trimmedName,
          found_id: globalData.id,
          found_name: globalData.name,
          found_company_id: globalData.company_id,
          coa_account_id: globalData.coa_account_id,
          warning: "Different company than expected!",
        });
        return { id: globalData.id, isFallback: true };
      }
    }

    // No data found - log all possible reasons
    logInfo("getPaymentMethodId: Payment method not found, using default", {
      requested: trimmedName,
      fallback_reason: "not_found_in_database",
      default_id: 20,
      company_filter: companyId || "none",
      search_attempted: {
        table: "payment_methods",
        column: "name",
        operator: "ilike (case-insensitive)",
        value: trimmedName,
        is_active_filter: true,
      },
      troubleshooting_suggestions: [
        "Check if payment_method name exists in payment_methods table",
        "Check if name has trailing/leading spaces",
        "Check if payment_method is_active = true",
        'Check if there are similar names with different casing (e.g., "Cash" vs "CASH")',
        "Verify the exact name in the source data",
        "Check for duplicate payment method names across companies",
      ],
    });

    // Log available payment methods for debugging (limited to first 10)
    const { data: allPaymentMethods, error: listError } = await supabase
      .from("payment_methods")
      .select("id, name, code, is_active, company_id")
      .limit(10);

    if (!listError) {
      logInfo("getPaymentMethodId: Available payment methods (sample)", {
        requested: trimmedName,
        available_count: allPaymentMethods?.length,
        available_methods: allPaymentMethods?.map((pm) => ({
          id: pm.id,
          name: pm.name,
          code: pm.code,
          is_active: pm.is_active,
          company_id: pm.company_id,
        })),
      });
    }

    // Default to CASH PT (id 20) if not found
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

    // Add FAILED status filter by default
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
   * Get failed transaction by ID with error details
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
   * Updates the failed transaction with corrected data and sets status back to READY
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

    logInfo("Fixing failed transaction", {
      id,
      source_ref: existing.source_ref,
      current_failed_reason: existing.failed_reason,
      updates: Object.keys(updates),
    });

    // Resolve payment method if provided as string
    if (typeof updates.payment_method_id === "string") {
      const resolvedId = await this.resolvePaymentMethodId(
        updates.payment_method_id,
      );
      (updates as any).payment_method_id = resolvedId;
    }

    // Clear failed fields and set status to READY
    // NOTE: failed_at and failed_reason are NOT cleared to preserve history
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

      logInfo("Successfully fixed failed transaction", {
        id,
        source_ref: existing.source_ref,
        new_status: "READY",
      });

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

    logInfo("Batch fix completed", {
      total: ids.length,
      fixed: results.fixed.length,
      failed: results.failed.length,
    });

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

    logInfo("Deleting failed transaction", {
      id,
      source_ref: existing.source_ref,
      failed_reason: existing.failed_reason,
    });

    // Hard delete for failed transactions
    const { error } = await supabase
      .from("aggregated_transactions")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete failed transaction: ${error.message}`);
    }
  }
}

export const posAggregatesService = new PosAggregatesService();
