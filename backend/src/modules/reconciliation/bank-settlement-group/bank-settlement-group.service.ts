/**
 * Settlement Group Service
 * Business logic for bulk settlement reconciliation
 */

import { settlementGroupRepository, SettlementGroupRepository } from "./bank-settlement-group.repository";
import { reconciliationOrchestratorService } from "../orchestrator/reconciliation-orchestrator.service";
import {
  SettlementGroupStatus,
  CreateSettlementGroupDto,
  CreateSettlementGroupResultDto,
  SettlementGroup,
  SettlementAggregate,
  AvailableAggregateDto,
} from "./bank-settlement-group.types";
import {
  SettlementGroupNotFoundError,
  DuplicateAggregateError,
  AggregateAlreadyReconciledError,
  StatementAlreadyReconciledError,
  DifferenceThresholdExceededError,
  SettlementAlreadyConfirmedError,
  AggregateReconciledElsewhereError,
} from "./bank-settlement-group.errors";
import { logError, logInfo } from "../../../config/logger";
import { bankSettlementConfig } from "./bank-settlement-group.config";

export class SettlementGroupService {
  private readonly repository: SettlementGroupRepository;

  constructor(repository: SettlementGroupRepository) {
    this.repository = repository;
  }

  /**
   * Create a new settlement group (BULK SETTLEMENT)
   * Maps 1 Bank Statement → Multiple Aggregates
   *
   * @param dto - Settlement group creation data
   * @returns Promise<CreateSettlementGroupResultDto> - Creation result with group details
   * @throws {StatementAlreadyReconciledError} When bank statement is already reconciled
   * @throws {AggregateAlreadyReconciledError} When any aggregate is already reconciled
   * @throws {DifferenceThresholdExceededError} When difference exceeds allowed threshold
   */
  async createSettlementGroup(dto: CreateSettlementGroupDto): Promise<CreateSettlementGroupResultDto> {
    logInfo("Creating settlement group", {
      companyId: dto.companyId,
      bankStatementId: dto.bankStatementId,
      aggregateCount: dto.aggregateIds.length,
    });

    // 1. Validate bank statement
    const statement = await this.repository.getBankStatementById(dto.bankStatementId);
    if (!statement) {
      throw new SettlementGroupNotFoundError(dto.bankStatementId);
    }

    if (statement.is_reconciled) {
      throw new StatementAlreadyReconciledError(dto.bankStatementId);
    }

    const statementAmount = statement.amount;
    const bankName = statement.bank_accounts?.banks?.bank_name || undefined;
    const paymentMethod: string | undefined = undefined; // dari statement, bukan bank_accounts

    // 2. Validate aggregate IDs (check for duplicates in request)
    const uniqueIds = [...new Set(dto.aggregateIds)];
    if (uniqueIds.length !== dto.aggregateIds.length) {
      throw new DuplicateAggregateError("DUPLICATE_IN_REQUEST");
    }

    // 3. Validate all aggregates
    const aggregateDetails = await Promise.all(
      dto.aggregateIds.map(async (aggregateId) => {
        const aggregate = await this.repository.getAggregateById(aggregateId);
        if (!aggregate) {
          throw new SettlementGroupNotFoundError(aggregateId);
        }
        if (aggregate.is_reconciled) {
          throw new AggregateAlreadyReconciledError(aggregateId);
        }
        return aggregate;
      })
    );

    // 4. Calculate totals
    const totalAllocatedAmount = aggregateDetails.reduce((sum, agg) => sum + agg.nett_amount, 0);
    const difference = statementAmount - totalAllocatedAmount;
    const differencePercent = statementAmount !== 0 ? Math.abs(difference) / statementAmount : 0;

    // 4. Validate difference threshold
    const isWithinTolerance = differencePercent <= bankSettlementConfig.defaultTolerancePercent;
    const isWithinAbsoluteThreshold = Math.abs(difference) <= bankSettlementConfig.differenceThreshold;

    if (!isWithinTolerance && !isWithinAbsoluteThreshold && !dto.overrideDifference) {
      throw new DifferenceThresholdExceededError(
        difference,
        differencePercent,
        bankSettlementConfig.defaultTolerancePercent
      );
    }

    // 5. Determine status
    const isExactMatch = difference === 0;
    const isWithinAllowedThreshold = differencePercent <= bankSettlementConfig.defaultTolerancePercent || isWithinAbsoluteThreshold;
    // If overrideDifference is true, user is explicitly verifying the discrepancy is acceptable
    // So status should be RECONCILED, not DISCREPANCY
    const status = isExactMatch || isWithinAllowedThreshold || dto.overrideDifference
      ? SettlementGroupStatus.RECONCILED
      : SettlementGroupStatus.DISCREPANCY;

    // 6. Create settlement group
    const groupId = await this.repository.createSettlementGroup({
      companyId: dto.companyId,
      bankStatementId: dto.bankStatementId,
      settlementDate: statement.transaction_date,
      paymentMethod,
      bankName,
      totalStatementAmount: statementAmount,
      totalAllocatedAmount,
      difference,
      notes: dto.notes,
      createdBy: dto.userId,
      status,
    });

    // 7. Add aggregates to group
    const aggregateRecords = aggregateDetails.map((agg) => ({
      aggregateId: agg.id,
      allocatedAmount: agg.nett_amount,
      originalAmount: agg.nett_amount,
    }));

    await this.repository.addAggregatesToGroup(groupId, aggregateRecords);

    // 8. Update status and confirm
    const confirmedAt = new Date().toISOString();
    await this.repository.updateStatus(groupId, status, confirmedAt);

    // 9. Mark aggregates and bank statement as reconciled
    if (status === SettlementGroupStatus.RECONCILED) {
      try {
        await this.repository.markAggregatesAsReconciled(dto.aggregateIds);
        await this.repository.markBankStatementAsReconciled(dto.bankStatementId);
      } catch (error) {
        logError("Failed to mark as reconciled during settlement group creation", {
          groupId,
          bankStatementId: dto.bankStatementId,
          aggregateIds: dto.aggregateIds,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Continue without throwing - the settlement group is created, just the reconciliation flags might need manual fix
      }
    }

    // 10. Fetch the created group to get settlement_number
    const createdGroup = await this.repository.findById(groupId);

    logInfo("Settlement group created successfully", {
      groupId,
      settlementNumber: createdGroup?.settlement_number,
      statementAmount,
      totalAllocatedAmount,
      difference,
      status,
    });

    return {
      success: true,
      groupId,
      settlementNumber: createdGroup?.settlement_number || "",
      bankStatementId: dto.bankStatementId,
      statementAmount,
      totalAllocatedAmount,
      difference,
      differencePercent,
      aggregateCount: dto.aggregateIds.length,
      status,
    };
  }

  /**
   * Get settlement group by ID
   */
  async getSettlementGroup(id: string): Promise<SettlementGroup> {
    const group = await this.repository.findById(id);
    if (!group) {
      throw new SettlementGroupNotFoundError(id);
    }
    return group;
  }

  /**
   * Get settlement group by settlement number
   */
  async getSettlementGroupByNumber(settlementNumber: string): Promise<SettlementGroup> {
    const group = await this.repository.findBySettlementNumber(settlementNumber);
    if (!group) {
      throw new SettlementGroupNotFoundError(settlementNumber);
    }
    return group;
  }

  /**
   * List settlement groups with filters
   */
  async listSettlementGroups(options?: {
    startDate?: string;
    endDate?: string;
    status?: SettlementGroupStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: SettlementGroup[]; total: number }> {
    return this.repository.findAll(options);
  }

  /**
   * Undo/rollback a settlement group
   * Uses soft delete via deleted_at instead of status change (database constraint issue)
   * 
   * @param groupId - The settlement group ID
   * @param options - Optional settings
   * @param options.revertReconciliation - If true, will also revert is_reconciled to false for aggregates and bank statement
   */
  async undoSettlementGroup(
    groupId: string,
    options?: {
      revertReconciliation?: boolean;
    }
  ): Promise<void> {
    logInfo("Undoing settlement group", { groupId, options });

    const group = await this.repository.findById(groupId);
    if (!group) {
      throw new SettlementGroupNotFoundError(groupId);
    }

    // Check if already undone (soft deleted)
    if (group.deleted_at) {
      throw new SettlementAlreadyConfirmedError(groupId);
    }

    // Soft delete the settlement group using deleted_at
    await this.repository.softDelete(groupId);

    // If revertReconciliation is true, mark aggregates and bank statement as unreconciled
    if (options?.revertReconciliation === true) {
      const aggregateIds = group.aggregates?.map((agg: SettlementAggregate) => agg.aggregate_id) || [];
      if (aggregateIds.length > 0) {
        await this.repository.markAggregatesAsUnreconciled(aggregateIds);
        logInfo("Aggregates marked as unreconciled", {
          groupId,
          aggregatesCount: aggregateIds.length
        });
      }

      // Get bank_statement_id directly from database without transformation
      const bankStatementId = await this.repository.getBankStatementIdRaw(groupId);
      if (bankStatementId !== null) {
        try {
          await this.repository.markBankStatementAsUnreconciled(bankStatementId);
          logInfo("Bank statement marked as unreconciled", {
            groupId,
            bank_statement_id: bankStatementId
          });
        } catch (error) {
          logError("Failed to mark bank statement as unreconciled during undo", {
            groupId,
            bank_statement_id: bankStatementId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Continue without failing
        }
      } else {
        logInfo("Skipping bank statement unreconciliation - null bank_statement_id", {
          groupId
        });
      }
    } else {
      logInfo("Revert reconciliation disabled - keeping aggregates and statement as reconciled", {
        groupId
      });
    }

    logInfo("Settlement group undone successfully", {
      groupId,
      aggregatesCount: group.aggregates?.length || 0,
      revertReconciliation: options?.revertReconciliation,
    });
  }

  /**
   * Get soft-deleted settlement groups (for Trash View)
   */
  async getDeletedSettlementGroups(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ data: SettlementGroup[]; total: number }> {
    logInfo("Fetching deleted settlement groups", { options });
    
    const result = await this.repository.findDeleted(options);
    
    return {
      data: result.data,
      total: result.total,
    };
  }

  /**
   * Restore a soft-deleted settlement group
   * 
   * @param groupId - The settlement group ID to restore
   */
  async restoreSettlementGroup(groupId: string): Promise<void> {
    logInfo("Restoring settlement group", { groupId });

    // First check if group exists and is actually deleted (has deleted_at)
    // Using findByIdIncludingDeleted through repository to maintain clean architecture
    const groupData = await this.repository.findByIdIncludingDeleted(groupId);

    if (!groupData) {
      throw new SettlementGroupNotFoundError(groupId);
    }

    // Verify group is actually deleted (has deleted_at)
    if (!groupData.deleted_at) {
      throw new SettlementAlreadyConfirmedError("Group is not deleted");
    }

    // FIX: Add validation - check if any aggregates are already reconciled elsewhere
    // This prevents restoring a group when its aggregates have been used in another group
    const reconciledElsewhere = await this.repository.checkAggregatesReconciledElsewhere(groupId);
    if (reconciledElsewhere) {
      throw new AggregateReconciledElsewhereError(
        "Some aggregates in this group are already reconciled with another group. Cannot restore."
      );
    }

    // Restore the group
    await this.repository.restore(groupId);

    logInfo("Settlement group restored successfully", { groupId });
  }

  /**
   * Get available aggregates for settlement (using orchestrator like bank-reconciliation)
   * Shows ALL unreconciled aggregates without date filter
   */
  async getAvailableAggregates(options?: {
    startDate?: string;
    endDate?: string;
    bankAccountId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    // Get aggregates from orchestrator for a wide date range (all time)
    // If no date range provided, get aggregates from last 30 days as default
    const endDate = options?.endDate ? new Date(options.endDate) : new Date();
    const startDate = options?.startDate 
      ? new Date(options.startDate) 
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const aggregates = await reconciliationOrchestratorService.getAggregatesByDateRange(
      startDate,
      endDate
    );

    // Filter out reconciled aggregates
    const unreconciledAggregates = aggregates.filter(a => !a.reconciliation_status || a.reconciliation_status === 'PENDING');

    // Apply search filter if provided
    let filteredAggregates = unreconciledAggregates;
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      filteredAggregates = unreconciledAggregates.filter(a => 
        a.branch_name?.toLowerCase().includes(searchLower) ||
        a.payment_method_name?.toLowerCase().includes(searchLower) ||
        a.reference_number?.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const paginatedAggregates = filteredAggregates.slice(offset, offset + limit);

    // Transform to match frontend AvailableAggregateDto format
    const transformedData = paginatedAggregates.map(agg => ({
      id: agg.id,
      transaction_date: agg.transaction_date,
      gross_amount: agg.gross_amount,
      nett_amount: agg.nett_amount,
      payment_method_name: agg.payment_method_name,
      is_reconciled: agg.reconciliation_status === 'RECONCILED',
    }));

    return {
      data: transformedData,
      total: filteredAggregates.length,
    };
  }

  /**
   * Get aggregates for a specific date (used when bank statement is selected)
   */
  async getAggregatesByStatementDate(statementDate: string): Promise<any[]> {
    const date = new Date(statementDate);
    
    const aggregates = await reconciliationOrchestratorService.getAggregatesByDateRange(
      date,
      date
    );

    // Filter out reconciled aggregates
    const unreconciledAggregates = aggregates.filter(a => !a.reconciliation_status || a.reconciliation_status === 'PENDING');

    // Transform to match frontend format
    return unreconciledAggregates.map(agg => ({
      id: agg.id,
      transaction_date: agg.transaction_date,
      gross_amount: agg.gross_amount,
      nett_amount: agg.nett_amount,
      payment_method_name: agg.payment_method_name,
      branch_name: agg.branch_name,
      reference_number: agg.reference_number,
      is_reconciled: agg.reconciliation_status === 'RECONCILED',
    }));
  }

  /**
   * Get aggregates for a specific settlement group
   */
  async getSettlementAggregates(groupId: string): Promise<any[]> {
    const group = await this.repository.findById(groupId);
    if (!group) {
      throw new SettlementGroupNotFoundError(groupId);
    }
    return this.repository.getAggregatesByGroupId(groupId);
  }

  /**
   * Calculate suggested aggregates for a statement amount
   * Uses optimized knapsack-like algorithm to find best combinations
   */
  async getSuggestedAggregates(
    targetAmount: number,
    options?: {
      startDate?: string;
      endDate?: string;
      tolerancePercent?: number;
      maxAggregates?: number;
    }
  ): Promise<AvailableAggregateDto[]> {
    const tolerance = options?.tolerancePercent || bankSettlementConfig.suggestionDefaultTolerance;
    const maxAgg = options?.maxAggregates || bankSettlementConfig.suggestionMaxResults;

    // Get available aggregates using service method (which uses orchestrator)
    const { data: availableAggregates } = await this.getAvailableAggregates({
      startDate: options?.startDate,
      endDate: options?.endDate,
      limit: Math.min(200, maxAgg * 3), // Get more data for better optimization
    });

    // Use optimized algorithm to find best combination
    return this.findOptimalAggregateCombination(availableAggregates, targetAmount, tolerance, maxAgg);
  }

  /**
   * Find optimal combination of aggregates that best match target amount
   * Uses a knapsack-like approach with tolerance
   */
  private findOptimalAggregateCombination(
    aggregates: AvailableAggregateDto[],
    targetAmount: number,
    tolerancePercent: number,
    maxAggregates: number
  ): AvailableAggregateDto[] {
    const toleranceAmount = targetAmount * tolerancePercent;
    const minAcceptable = targetAmount - toleranceAmount;
    const maxAcceptable = targetAmount + toleranceAmount;

    // Sort by amount (largest first for better greedy start)
    const sorted = [...aggregates].sort((a, b) => b.nett_amount - a.nett_amount);

    let bestCombination: AvailableAggregateDto[] = [];
    let bestDifference = Infinity;

    // Try combinations starting with different base aggregates
    for (let startIdx = 0; startIdx < Math.min(sorted.length, 10); startIdx++) {
      const combination = this.buildCombinationFromStart(
        sorted,
        startIdx,
        targetAmount,
        minAcceptable,
        maxAcceptable,
        maxAggregates
      );

      if (combination.length > 0) {
        const total = combination.reduce((sum, agg) => sum + agg.nett_amount, 0);
        const difference = Math.abs(total - targetAmount);

        // Update best combination if this is better
        if (difference < bestDifference ||
            (difference === bestDifference && combination.length < bestCombination.length)) {
          bestCombination = combination;
          bestDifference = difference;
        }

        // If we found exact match, return immediately
        if (difference === 0) {
          break;
        }
      }
    }

    // If no good combination found, fall back to simple greedy
    if (bestCombination.length === 0) {
      bestCombination = this.fallbackGreedyAlgorithm(sorted, targetAmount, toleranceAmount, maxAggregates);
    }

    return bestCombination;
  }

  /**
   * Build combination starting from a specific aggregate
   */
  private buildCombinationFromStart(
    sortedAggregates: AvailableAggregateDto[],
    startIdx: number,
    targetAmount: number,
    minAcceptable: number,
    maxAcceptable: number,
    maxAggregates: number
  ): AvailableAggregateDto[] {
    const combination: AvailableAggregateDto[] = [sortedAggregates[startIdx]];
    let currentSum = sortedAggregates[startIdx].nett_amount;

    // Add more aggregates that get us closer to target
    for (let i = 0; i < sortedAggregates.length && combination.length < maxAggregates; i++) {
      if (i === startIdx) continue; // Skip the starting aggregate

      const candidate = sortedAggregates[i];
      const potentialSum = currentSum + candidate.nett_amount;

      // Only add if it keeps us within acceptable range
      if (potentialSum >= minAcceptable && potentialSum <= maxAcceptable) {
        combination.push(candidate);
        currentSum = potentialSum;

        // If we're very close to target, stop adding more
        if (Math.abs(currentSum - targetAmount) / targetAmount < 0.01) { // Within 1%
          break;
        }
      }
    }

    return combination;
  }

  /**
   * Fallback greedy algorithm when optimization fails
   */
  private fallbackGreedyAlgorithm(
    sortedAggregates: AvailableAggregateDto[],
    targetAmount: number,
    toleranceAmount: number,
    maxAggregates: number
  ): AvailableAggregateDto[] {
    const suggestions: AvailableAggregateDto[] = [];
    let currentSum = 0;

    for (const agg of sortedAggregates) {
      if (suggestions.length >= maxAggregates) break;

      const potentialSum = currentSum + agg.nett_amount;

      // If adding this aggregate doesn't exceed tolerance, include it
      if (potentialSum <= targetAmount + toleranceAmount) {
        suggestions.push(agg);
        currentSum = potentialSum;
      }
    }

    return suggestions;
  }
}

export const settlementGroupService = new SettlementGroupService(settlementGroupRepository);

