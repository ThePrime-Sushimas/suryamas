import {
  bankReconciliationRepository,
  BankReconciliationRepository,
} from "./bank-reconciliation.repository";
import {
  BankReconciliationStatus,
  MatchingCriteria,
  ReconciliationMatch,
  MultiMatchResultDto,
  MultiMatchSuggestion,
} from "./bank-reconciliation.types";
import {
  AlreadyReconciledError,
  NoMatchFoundError,
  DifferenceThresholdExceededError,
} from "./bank-reconciliation.errors";
import { getReconciliationConfig } from "./bank-reconciliation.config";
import { IReconciliationOrchestratorService } from "../orchestrator/reconciliation-orchestrator.types";
import {
  FeeReconciliationService,
  feeReconciliationService,
} from "../fee-reconciliation/fee-reconciliation.service";
import { reconciliationOrchestratorService } from "../orchestrator/reconciliation-orchestrator.service";

export class BankReconciliationService {
  private readonly config = getReconciliationConfig();

  private readonly multiMatchConfig = {
    defaultTolerancePercent: 0.05,
    defaultDateToleranceDays: 2,
    defaultMaxStatements: 5,
    differenceThreshold: 100,
  };

  constructor(
    private readonly repository: BankReconciliationRepository,
    private readonly orchestratorService: IReconciliationOrchestratorService,
    private readonly feeReconciliationService: FeeReconciliationService,
  ) {}

  async reconcile(
    aggregateId: string,
    statementId: string,
    userId?: string,
    notes?: string,
    overrideDifference?: boolean,
  ): Promise<any> {
    const statement = await this.repository.findById(statementId);
    if (!statement) {
      throw new Error("Bank statement not found");
    }

    if (statement.is_reconciled) {
      throw new AlreadyReconciledError(statementId);
    }

    await this.repository.markAsReconciled(statementId, aggregateId);

    await this.orchestratorService.updateReconciliationStatus(
      aggregateId,
      "RECONCILED",
      statementId,
      userId,
    );

    await this.repository.logAction({
      userId,
      action: "MANUAL_RECONCILE",
      statementId,
      aggregateId,
      details: {
        notes,
        overrideDifference,
      },
    });

    return {
      success: true,
      matched: true,
      statementId,
      aggregateId,
      notes,
      overrideDifference,
    };
  }

  async undo(statementId: string, userId?: string): Promise<void> {
    const statement = await this.repository.findById(statementId);
    if (!statement) {
      throw new Error("Bank statement not found");
    }

    await this.repository.undoReconciliation(statementId);

    if (statement.reconciliation_id) {
      await this.orchestratorService.updateReconciliationStatus(
        statement.reconciliation_id,
        "PENDING",
      );
    }

    await this.repository.logAction({
      userId,
      action: "UNDO",
      statementId,
      aggregateId: statement.reconciliation_id,
      details: {},
    });
  }

  async autoMatch(
    startDate: Date,
    endDate: Date,
    bankAccountId?: number,
    userId?: string,
    criteria?: Partial<MatchingCriteria>,
  ): Promise<any> {
    const matchingCriteria = {
      amountTolerance: this.config.amountTolerance,
      dateBufferDays: this.config.dateBufferDays,
      ...criteria,
    };

    const statements = await this.repository.getUnreconciledBatch(
      startDate,
      endDate,
      this.config.autoMatchBatchSize,
      0,
      bankAccountId,
    );

    const bufferStart = new Date(startDate);
    bufferStart.setDate(bufferStart.getDate() - matchingCriteria.dateBufferDays);
    const bufferEnd = new Date(endDate);
    bufferEnd.setDate(bufferEnd.getDate() + matchingCriteria.dateBufferDays);

    const aggregates = await this.orchestratorService.getAggregatesByDateRange(
      bufferStart,
      bufferEnd,
    );

    const matches: ReconciliationMatch[] = [];
    const remainingStatements = [...statements];
    const remainingAggregates = [...aggregates];

    this.processMatching(
      remainingStatements,
      remainingAggregates,
      matches,
      (s: any, a: any) =>
        s.reference_number &&
        a.reference_number &&
        s.reference_number === a.reference_number,
      "EXACT_REF",
      100,
    );

    this.processMatching(
      remainingStatements,
      remainingAggregates,
      matches,
      (s: any, a: any) => {
        const sAmount = s.credit_amount - s.debit_amount;
        const sDate = new Date(s.transaction_date).toDateString();
        const aDate = new Date(a.transaction_date).toDateString();
        return (
          Math.abs(sAmount - a.nett_amount) <=
            matchingCriteria.amountTolerance && sDate === aDate
        );
      },
      "EXACT_AMOUNT_DATE",
      90,
    );

    this.processMatching(
      remainingStatements,
      remainingAggregates,
      matches,
      (s: any, a: any) => {
        const sAmount = s.credit_amount - s.debit_amount;
        const sDate = new Date(s.transaction_date).getTime();
        const aDate = new Date(a.transaction_date).getTime();
        const dayDiff = Math.abs(sDate - aDate) / (1000 * 3600 * 24);
        return (
          Math.abs(sAmount - a.nett_amount) <=
            matchingCriteria.amountTolerance &&
          dayDiff <= matchingCriteria.dateBufferDays
        );
      },
      "FUZZY_AMOUNT_DATE",
      80,
    );

    const bulkUpdates: any[] = [];
    for (const match of matches) {
      await this.repository.markAsReconciled(
        match.statementId,
        match.aggregateId,
      );

      bulkUpdates.push({
        aggregateId: match.aggregateId,
        status: "RECONCILED",
        statementId: match.statementId,
      });

      await this.repository.logAction({
        userId,
        action: "AUTO_MATCH",
        statementId: match.statementId,
        aggregateId: match.aggregateId,
        details: {
          matchScore: match.matchScore,
          matchCriteria: match.matchCriteria,
        },
      });
    }

    if (bulkUpdates.length > 0) {
      await this.orchestratorService.bulkUpdateReconciliationStatus(
        bulkUpdates,
      );
    }

    return {
      matched: matches.length,
      unmatched: remainingStatements.length,
      matches,
    };
  }

  private processMatching(
    statements: any[],
    aggregates: any[],
    matches: ReconciliationMatch[],
    predicate: (s: any, a: any) => boolean,
    criteriaName: ReconciliationMatch["matchCriteria"],
    score: number,
  ) {
    for (let i = statements.length - 1; i >= 0; i--) {
      const statement = statements[i];
      const matchIdx = aggregates.findIndex((agg) => predicate(statement, agg));

      if (matchIdx !== -1) {
        const agg = aggregates[matchIdx];
        matches.push({
          aggregateId: agg.id,
          statementId: statement.id,
          matchScore: score,
          matchCriteria: criteriaName,
          difference: Math.abs(
            statement.credit_amount - statement.debit_amount - agg.nett_amount,
          ),
        });

        statements.splice(i, 1);
        aggregates.splice(matchIdx, 1);
      }
    }
  }

  async getStatements(
    startDate?: Date,
    endDate?: Date,
    bankAccountId?: number,
    options?: {
      status?: 'RECONCILED' | 'UNRECONCILED' | 'DISCREPANCY';
      search?: string;
      isReconciled?: boolean;
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    },
  ): Promise<any[]> {
    const statements = await this.repository.getByDateRange(
      startDate,
      endDate,
      bankAccountId,
      options,
    );

    return statements.map((s) => {
      const isReconciled = s.is_reconciled;
      const bankAmount = s.credit_amount - s.debit_amount;
      const hasMatch = !!s.matched_aggregate;
      const difference = hasMatch
        ? Math.abs(bankAmount - s.matched_aggregate.nett_amount)
        : 0;

      let status: BankReconciliationStatus = BankReconciliationStatus.UNRECONCILED;
      if (isReconciled) {
        if (difference === 0) {
          status = s.reconciliation_id 
            ? BankReconciliationStatus.MANUALLY_MATCHED 
            : BankReconciliationStatus.AUTO_MATCHED;
        } else if (difference <= this.config.differenceThreshold) {
          status = BankReconciliationStatus.AUTO_MATCHED;
        } else {
          status = BankReconciliationStatus.DISCREPANCY;
        }
      } else {
        status = hasMatch ? BankReconciliationStatus.PENDING : BankReconciliationStatus.UNRECONCILED;
      }

      // Apply status filter at service level for DISCREPANCY
      if (options?.status === 'DISCREPANCY' && status !== BankReconciliationStatus.DISCREPANCY) {
        return null;
      }

      return {
        ...s,
        amount: bankAmount,
        status,
        potentialMatches: [],
      };
    }).filter((s): s is NonNullable<typeof s> => s !== null);
  }

  async getPotentialMatches(
    statementId: string,
  ): Promise<any[]> {
    const s = await this.repository.findById(statementId);
    if (!s) throw new Error("Statement not found");

    const sAmount = s.credit_amount - s.debit_amount;
    return this.orchestratorService.findPotentialAggregatesForStatement(
      sAmount,
      new Date(s.transaction_date),
      this.config.amountTolerance,
      this.config.dateBufferDays,
    );
  }

  async getBankAccountsStatus(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.repository.getBankAccountsStatus(startDate, endDate);
  }

  async getAllBankAccounts(): Promise<any[]> {
    return this.repository.getAllBankAccounts();
  }

  async getSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    return this.orchestratorService.getReconciliationSummary(
      startDate,
      endDate,
    );
  }

  calculateDifference(
    aggregateAmount: number,
    statementAmount: number,
  ): { absolute: number; percentage: number } {
    const absolute = Math.abs(aggregateAmount - statementAmount);
    const percentage =
      aggregateAmount !== 0 ? (absolute / aggregateAmount) * 100 : 0;

    return { absolute, percentage };
  }

  async createMultiMatch(
    aggregateId: string,
    statementIds: string[],
    userId?: string,
    notes?: string,
    overrideDifference?: boolean,
  ): Promise<MultiMatchResultDto> {
    const aggregate = await this.orchestratorService.getAggregate(aggregateId);
    if (!aggregate) {
      throw new Error("Aggregate tidak ditemukan");
    }

    const existingGroup = await this.repository.isAggregateInGroup(aggregateId);
    if (existingGroup) {
      throw new Error("Aggregate sudah menjadi bagian dari group");
    }

    const statements = await Promise.all(
      statementIds.map(id => this.repository.findById(id))
    );

    const invalidStatements = statements.filter(
      (s) => !s || s.is_reconciled
    );
    if (invalidStatements.length > 0) {
      throw new Error("Beberapa statement tidak valid atau sudah dicocokkan");
    }

    const totalBankAmount = statements.reduce((sum, s) => {
      const amount = (s.credit_amount || 0) - (s.debit_amount || 0);
      return sum + amount;
    }, 0);

    const aggregateAmount = aggregate.nett_amount;
    const difference = totalBankAmount - aggregateAmount;
    const differencePercent = aggregateAmount !== 0
      ? Math.abs(difference) / aggregateAmount
      : 0;

    const isWithinTolerance = differencePercent <= this.multiMatchConfig.defaultTolerancePercent;
    if (!isWithinTolerance && !overrideDifference) {
      throw new Error(
        `Selisih ${(differencePercent * 100).toFixed(2)}% melebihi tolerance ${(this.multiMatchConfig.defaultTolerancePercent * 100)}%. Gunakan override jika ingin melanjutkan.`
      );
    }

    const groupId = await this.repository.createReconciliationGroup({
      aggregateId,
      statementIds,
      totalBankAmount,
      aggregateAmount,
      difference,
      notes,
      reconciledBy: userId,
    });

    const statementDetails = statements.map(s => ({
      statementId: s.id,
      amount: (s.credit_amount || 0) - (s.debit_amount || 0),
    }));
    await this.repository.addStatementsToGroup(groupId, statementDetails);

    await this.repository.markStatementsAsReconciledWithGroup(statementIds, groupId);

    await this.orchestratorService.updateReconciliationStatus(
      aggregateId,
      "RECONCILED",
      undefined,
      userId,
    );

    await this.repository.logAction({
      userId,
      action: "MANUAL_RECONCILE" as any,
      aggregateId,
      details: {
        groupId,
        statementIds,
        totalBankAmount,
        aggregateAmount,
        difference,
        differencePercent,
        overrideDifference,
        isMultiMatch: true,
      },
    });

    return {
      success: true,
      groupId,
      aggregateId,
      statementIds,
      totalBankAmount,
      aggregateAmount,
      difference,
      differencePercent,
    };
  }

  async undoMultiMatch(
    groupId: string,
    userId?: string,
  ): Promise<void> {
    const group = await this.repository.getReconciliationGroupById(groupId);
    if (!group) {
      throw new Error("Group tidak ditemukan");
    }

    if (group.deleted_at) {
      throw new Error("Group sudah di-undo");
    }

    await this.repository.undoReconciliationGroup(groupId);

    if (group.aggregate_id) {
      await this.orchestratorService.updateReconciliationStatus(
        group.aggregate_id,
        "PENDING",
      );
    }

    await this.repository.logAction({
      userId,
      action: "UNDO" as any,
      aggregateId: group.aggregate_id,
      details: {
        groupId,
        isMultiMatchUndo: true,
      },
    });
  }

  async getSuggestedGroupStatements(
    aggregateId: string,
    tolerancePercent?: number,
    dateToleranceDays?: number,
    maxStatements?: number,
  ): Promise<MultiMatchSuggestion[]> {
    const aggregate = await this.orchestratorService.getAggregate(aggregateId);
    if (!aggregate) {
      throw new Error("Aggregate tidak ditemukan");
    }

    const tolerance = tolerancePercent ?? this.multiMatchConfig.defaultTolerancePercent;
    const days = dateToleranceDays ?? this.multiMatchConfig.defaultDateToleranceDays;
    const max = maxStatements ?? this.multiMatchConfig.defaultMaxStatements;

    const aggregateDate = new Date(aggregate.transaction_date);
    const startDate = new Date(aggregateDate);
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date(aggregateDate);
    endDate.setDate(endDate.getDate() + days);

    const statements = await this.repository.getUnreconciledStatementsForSuggestion(
      startDate,
      endDate,
    );

    const suggestions = this.findStatementCombinations(
      statements,
      aggregate.nett_amount,
      tolerance,
      max,
    );

    return suggestions;
  }

  private findStatementCombinations(
    statements: any[],
    targetAmount: number,
    tolerancePercent: number,
    maxStatements: number,
  ): MultiMatchSuggestion[] {
    const suggestions: MultiMatchSuggestion[] = [];
    const amounts = statements.map(s => ({
      ...s,
      amount: (s.credit_amount || 0) - (s.debit_amount || 0),
    }));

    const midGroups = new Map<string, any[]>();
    amounts.forEach(stmt => {
      const mid = this.extractMID(stmt.description);
      if (mid) {
        if (!midGroups.has(mid)) {
          midGroups.set(mid, []);
        }
        midGroups.get(mid)!.push(stmt);
      }
    });

    for (const [mid, stmts] of midGroups) {
      const combos = this.findExactMatchCombinations(
        stmts,
        targetAmount,
        tolerancePercent,
        maxStatements,
      );

      combos.forEach(combo => {
        const totalAmount = combo.reduce((sum: number, s: any) => sum + s.amount, 0);
        suggestions.push({
          statements: combo,
          totalAmount,
          matchPercentage: 1 - Math.abs(totalAmount - targetAmount) / targetAmount,
          confidence: 'HIGH',
          reason: `MID: ${mid}`,
        });
      });
    }

    const nonMidStatements = amounts.filter(s => !this.extractMID(s.description));
    const fallbackCombos = this.findExactMatchCombinations(
      nonMidStatements,
      targetAmount,
      tolerancePercent,
      maxStatements,
    );

    fallbackCombos.forEach(combo => {
      const totalAmount = combo.reduce((sum: number, s: any) => sum + s.amount, 0);
      suggestions.push({
        statements: combo,
        totalAmount,
        matchPercentage: 1 - Math.abs(totalAmount - targetAmount) / targetAmount,
        confidence: 'MEDIUM',
        reason: 'Amount match only',
      });
    });

    return suggestions.sort((a, b) => {
      const confidenceOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      }
      return b.matchPercentage - a.matchPercentage;
    });
  }

  private findExactMatchCombinations(
    statements: any[],
    targetAmount: number,
    tolerancePercent: number,
    maxStatements: number,
  ): any[][] {
    const results: any[][] = [];
    const tolerance = targetAmount * tolerancePercent;
    const minAmount = targetAmount - tolerance;
    const maxAmount = targetAmount + tolerance;

    const findCombos = (index: number, current: any[], currentSum: number) => {
      if (current.length > maxStatements) return;
      if (currentSum >= minAmount && currentSum <= maxAmount) {
        results.push([...current]);
      }

      for (let i = index; i < statements.length; i++) {
        const stmt = statements[i];
        if (currentSum + stmt.amount > maxAmount) continue;
        current.push(stmt);
        findCombos(i + 1, current, currentSum + stmt.amount);
        current.pop();
      }
    };

    findCombos(0, [], 0);

    return results.sort((a, b) => {
      const sumA = a.reduce((s: number, st: any) => s + st.amount, 0);
      const sumB = b.reduce((s: number, st: any) => s + st.amount, 0);
      return Math.abs(sumA - targetAmount) - Math.abs(sumB - targetAmount);
    }).slice(0, 10);
  }

  private extractMID(description: string): string | null {
    const midRegex = /MID[:\s]*([0-9]+)/i;
    const match = description.match(midRegex);
    return match ? match[1] : null;
  }

  async getReconciliationGroups(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.repository.getReconciliationGroups(startDate, endDate);
  }

  async getMultiMatchGroup(groupId: string): Promise<any> {
    return this.repository.getReconciliationGroupById(groupId);
  }
}

export const bankReconciliationService = new BankReconciliationService(
  bankReconciliationRepository,
  reconciliationOrchestratorService,
  feeReconciliationService,
);

