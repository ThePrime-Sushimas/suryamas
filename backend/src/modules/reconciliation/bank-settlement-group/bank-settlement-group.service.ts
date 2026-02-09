/**
 * Settlement Group Service
 * Business logic for bulk settlement reconciliation
 */

import { settlementGroupRepository, SettlementGroupRepository } from "./bank-settlement-group.repository";
import {
  SettlementGroupStatus,
  CreateSettlementGroupDto,
  CreateSettlementGroupResultDto,
  SettlementGroup,
  AvailableAggregateDto,
} from "./bank-settlement-group.types";
import {
  SettlementGroupNotFoundError,
  DuplicateAggregateError,
  AggregateAlreadyReconciledError,
  StatementAlreadyReconciledError,
  DifferenceThresholdExceededError,
  SettlementAlreadyConfirmedError,
} from "./bank-settlement-group.errors";
import { logError, logInfo } from "../../../config/logger";

export class SettlementGroupService {
  private readonly repository: SettlementGroupRepository;
  private readonly config = {
    defaultTolerancePercent: 0.05, // 5% tolerance
    differenceThreshold: 100, // Rp 100 difference threshold
  };

  constructor(repository: SettlementGroupRepository) {
    this.repository = repository;
  }

  /**
   * Create a new settlement group (BULK SETTLEMENT)
   * Maps 1 Bank Statement → Multiple Aggregates
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

    // 2. Validate all aggregates
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

    // 3. Calculate totals
    const totalAllocatedAmount = aggregateDetails.reduce((sum, agg) => sum + agg.nett_amount, 0);
    const difference = statementAmount - totalAllocatedAmount;
    const differencePercent = statementAmount !== 0 ? Math.abs(difference) / statementAmount : 0;

    // 4. Validate difference threshold
    const isWithinTolerance = differencePercent <= this.config.defaultTolerancePercent;
    const isWithinAbsoluteThreshold = Math.abs(difference) <= this.config.differenceThreshold;

    if (!isWithinTolerance && !isWithinAbsoluteThreshold && !dto.overrideDifference) {
      throw new DifferenceThresholdExceededError(
        difference,
        differencePercent,
        this.config.defaultTolerancePercent
      );
    }

    // 5. Determine status
    const isExactMatch = difference === 0;
    const isWithinAllowedThreshold = differencePercent <= this.config.defaultTolerancePercent || isWithinAbsoluteThreshold;
    const status = isExactMatch || isWithinAllowedThreshold 
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
      branchName: agg.branch_name || null,
      branchCode: agg.branch_code || null,
      allocatedAmount: agg.nett_amount,
      originalAmount: agg.nett_amount,
    }));

    await this.repository.addAggregatesToGroup(groupId, aggregateRecords);

    // 8. Update status and confirm
    const confirmedAt = new Date().toISOString();
    await this.repository.updateStatus(groupId, status, confirmedAt);

    // 9. Fetch the created group to get settlement_number
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
   */
  async undoSettlementGroup(
    groupId: string,
    userId?: string | null,
    companyId?: string | null
  ): Promise<void> {
    logInfo("Undoing settlement group", { groupId, userId });

    const group = await this.repository.findById(groupId);
    if (!group) {
      throw new SettlementGroupNotFoundError(groupId);
    }

    if (group.status === SettlementGroupStatus.UNDO) {
      throw new SettlementAlreadyConfirmedError(groupId);
    }

    // Soft delete the settlement group
    await this.repository.softDelete(groupId);

    // Mark aggregates as unreconciled (need to do this separately via orchestrator)
    // For now, we'll just log this action
    logInfo("Settlement group undone successfully", {
      groupId,
      aggregatesCount: group.aggregates?.length || 0,
    });
  }

  /**
   * Get available aggregates for settlement
   */
  async getAvailableAggregates(options?: {
    startDate?: string;
    endDate?: string;
    bankAccountId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AvailableAggregateDto[]; total: number }> {
    return this.repository.getAvailableAggregates(options);
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
   * Uses greedy algorithm to find combinations that match target amount
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
    const tolerance = options?.tolerancePercent || 0.05;
    const maxAgg = options?.maxAggregates || 10;

    // Get available aggregates
    const { data: availableAggregates } = await this.repository.getAvailableAggregates({
      startDate: options?.startDate,
      endDate: options?.endDate,
      limit: 100,
    });

    // Sort by closest match to target amount
    const sorted = [...availableAggregates].sort(
      (a, b) => Math.abs(a.nett_amount - targetAmount) - Math.abs(b.nett_amount - targetAmount)
    );

    // Simple greedy algorithm: pick aggregates that sum up closest to target
    const suggestions: AvailableAggregateDto[] = [];
    let currentSum = 0;

    for (const agg of sorted) {
      if (suggestions.length >= maxAgg) break;
      
      const potentialSum = currentSum + agg.nett_amount;
      const toleranceAmount = targetAmount * tolerance;

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

