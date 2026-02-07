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
import { logError } from "../../../config/logger";

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
    companyId?: string,
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
      companyId: companyId || statement.company_id,
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

  async undo(statementId: string, userId?: string, companyId?: string): Promise<void> {
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
      companyId: companyId || statement.company_id,
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
    companyId?: string,
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
        companyId: companyId || '',
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

  /**
   * Preview auto-match results without updating database
   */
  async previewAutoMatch(
    startDate: Date,
    endDate: Date,
    bankAccountId?: number,
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

    const matches: any[] = [];
    const remainingStatements = [...statements];
    const remainingAggregates = [...aggregates];

    // Helper to process matching and return details
    const findMatches = (
      stmts: any[],
      aggs: any[],
      predicate: (s: any, a: any) => boolean,
      criteriaName: string,
      score: number,
    ) => {
      for (let i = stmts.length - 1; i >= 0; i--) {
        const stmt = stmts[i];
        const matchIdx = aggs.findIndex((agg) => predicate(stmt, agg));

        if (matchIdx !== -1) {
          const agg = aggs[matchIdx];
          const stmtAmount = stmt.credit_amount - stmt.debit_amount;
          matches.push({
            statementId: stmt.id,
            statement: {
              id: stmt.id,
              transaction_date: stmt.transaction_date,
              description: stmt.description,
              reference_number: stmt.reference_number,
              debit_amount: stmt.debit_amount,
              credit_amount: stmt.credit_amount,
              amount: stmtAmount,
            },
            aggregate: {
              id: agg.id,
              transaction_date: agg.transaction_date,
              nett_amount: agg.nett_amount,
              reference_number: agg.reference_number,
              payment_method_name: agg.payment_method_name,
              gross_amount: agg.gross_amount,
            },
            matchScore: score,
            matchCriteria: criteriaName,
            difference: Math.abs(stmtAmount - agg.nett_amount),
          });
          stmts.splice(i, 1);
          aggs.splice(matchIdx, 1);
        }
      }
    };

    // Run matching algorithms (same as autoMatch)
    findMatches(
      remainingStatements,
      remainingAggregates,
      (s, a) =>
        s.reference_number &&
        a.reference_number &&
        s.reference_number === a.reference_number,
      "EXACT_REF",
      100,
    );

    findMatches(
      remainingStatements,
      remainingAggregates,
      (s, a) => {
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

    findMatches(
      remainingStatements,
      remainingAggregates,
      (s, a) => {
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

    return {
      matches: matches.sort((a, b) => b.matchScore - a.matchScore),
      summary: {
        totalStatements: statements.length,
        matchedStatements: matches.length,
        unmatchedStatements: remainingStatements.length,
      },
      unmatchedStatements: remainingStatements.map(s => ({
        id: s.id,
        transaction_date: s.transaction_date,
        description: s.description,
        reference_number: s.reference_number,
        debit_amount: s.debit_amount,
        credit_amount: s.credit_amount,
        amount: s.credit_amount - s.debit_amount,
      })),
    };
  }

  /**
   * Confirm and reconcile selected matches only
   */
  async confirmAutoMatch(
    statementIds: string[],
    userId?: string,
    companyId?: string,
    criteria?: Partial<MatchingCriteria>,
  ): Promise<any> {
    // First, get all potential matches for the statements
    // We need to run the matching algorithm to find the best match for each statement
    
    // For now, we'll use a simplified approach:
    // Get the matches from the preview data stored in memory or
    // re-run matching for the selected statements only
    
    // Since we don't have access to the preview results here,
    // we'll need to fetch the statements and find their best matches
    
    const matchingCriteria = {
      amountTolerance: this.config.amountTolerance,
      dateBufferDays: this.config.dateBufferDays,
      ...criteria,
    };

    const matches: ReconciliationMatch[] = [];

    for (const statementId of statementIds) {
      const statement = await this.repository.findById(statementId);
      if (!statement || statement.is_reconciled) continue;

      const stmtAmount = statement.credit_amount - statement.debit_amount;
      const bufferStart = new Date(statement.transaction_date);
      bufferStart.setDate(bufferStart.getDate() - matchingCriteria.dateBufferDays);
      const bufferEnd = new Date(statement.transaction_date);
      bufferEnd.setDate(bufferEnd.getDate() + matchingCriteria.dateBufferDays);

      // Get aggregates for the statement's date range
      const aggregates = await this.orchestratorService.getAggregatesByDateRange(
        bufferStart,
        bufferEnd,
      );

      // Find best match for this statement
      let bestMatch: { agg: any; score: number; criteria: string } | null = null;

      for (const agg of aggregates) {
        if (agg.reconciliation_status === "RECONCILED") continue;

        const aggAmount = agg.nett_amount;
        const amountDiff = Math.abs(stmtAmount - aggAmount);
        const stmtDate = new Date(statement.transaction_date).toDateString();
        const aggDate = new Date(agg.transaction_date).toDateString();

        // Try EXACT_REF first
        if (
          statement.reference_number &&
          agg.reference_number &&
          statement.reference_number === agg.reference_number
        ) {
          bestMatch = { agg, score: 100, criteria: "EXACT_REF" };
          break;
        }

        // Try EXACT_AMOUNT_DATE
        if (amountDiff <= matchingCriteria.amountTolerance && stmtDate === aggDate) {
          const score = 90 - (amountDiff / (stmtAmount || 1)) * 10;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { agg, score, criteria: "EXACT_AMOUNT_DATE" };
          }
        }

        // Try FUZZY_AMOUNT_DATE
        if (amountDiff <= matchingCriteria.amountTolerance) {
          const dayDiff = Math.abs(
            new Date(statement.transaction_date).getTime() - new Date(agg.transaction_date).getTime()
          ) / (1000 * 3600 * 24);
          
          if (dayDiff <= matchingCriteria.dateBufferDays) {
            const score = 80 - (amountDiff / (stmtAmount || 1)) * 10 - (dayDiff * 5);
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { agg, score, criteria: "FUZZY_AMOUNT_DATE" };
            }
          }
        }
      }

      if (bestMatch) {
        matches.push({
          statementId: statement.id,
          aggregateId: bestMatch.agg.id,
          matchScore: bestMatch.score,
          matchCriteria: bestMatch.criteria as any,
          difference: Math.abs(stmtAmount - bestMatch.agg.nett_amount),
        });
      }
    }

    // Perform reconciliation for all matched pairs
    const reconciledMatches: any[] = [];
    for (const match of matches) {
      try {
        await this.repository.markAsReconciled(
          match.statementId,
          match.aggregateId,
        );

        await this.repository.logAction({
          companyId: companyId || '',
          userId,
          action: "AUTO_MATCH",
          statementId: match.statementId,
          aggregateId: match.aggregateId,
          details: {
            matchScore: match.matchScore,
            matchCriteria: match.matchCriteria,
          },
        });

        reconciledMatches.push(match);
      } catch (error: any) {
        logError("Error reconciling match", { 
          statementId: match.statementId, 
          aggregateId: match.aggregateId,
          error: error.message 
        });
      }
    }

    // Update orchestrator
    if (reconciledMatches.length > 0) {
      const bulkUpdates = reconciledMatches.map(m => ({
        aggregateId: m.aggregateId,
        status: "RECONCILED" as const,
        statementId: m.statementId,
      }));
      await this.orchestratorService.bulkUpdateReconciliationStatus(bulkUpdates);
    }

    return {
      matched: reconciledMatches.length,
      failed: matches.length - reconciledMatches.length,
      matches: reconciledMatches,
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
      // matched_aggregate is now populated from the repository join
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
        // matched_aggregate already populated from repository
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
    companyId?: string,
    notes?: string,
    overrideDifference?: boolean,
  ): Promise<MultiMatchResultDto> {
    // Remove duplicate statement IDs
    const uniqueStatementIds = [...new Set(statementIds)];
    
    const aggregate = await this.orchestratorService.getAggregate(aggregateId);
    if (!aggregate) {
      throw new Error("Aggregate tidak ditemukan");
    }

    const existingGroup = await this.repository.isAggregateInGroup(aggregateId);
    if (existingGroup) {
      throw new Error("Aggregate sudah menjadi bagian dari group");
    }

    const statements = await Promise.all(
      uniqueStatementIds.map(id => this.repository.findById(id))
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
      statementIds: uniqueStatementIds,
      totalBankAmount,
      aggregateAmount,
      difference,
      notes,
      reconciledBy: userId,
      companyId,
    });

    const statementDetails = statements.map(s => ({
      statementId: s.id,
      amount: (s.credit_amount || 0) - (s.debit_amount || 0),
    }));
    await this.repository.addStatementsToGroup(groupId, statementDetails);

    await this.repository.markStatementsAsReconciledWithGroup(uniqueStatementIds, groupId);

    await this.orchestratorService.updateReconciliationStatus(
      aggregateId,
      "RECONCILED",
      undefined,
      userId,
    );

    await this.repository.logAction({
      companyId: companyId || '',
      userId,
      action: "CREATE_MULTI_MATCH",
      aggregateId,
      details: {
        groupId,
        statementIds: uniqueStatementIds,
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
      statementIds: uniqueStatementIds,
      totalBankAmount,
      aggregateAmount,
      difference,
      differencePercent,
    };
  }

  async undoMultiMatch(
    groupId: string,
    userId?: string,
    companyId?: string,
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
      companyId: companyId || '',
      userId,
      action: "UNDO_MULTI_MATCH",
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

  // =====================================================
  // REVERSE MATCHING METHODS
  // =====================================================

  /**
   * Get all unreconciled bank statements
   * Used for reverse matching modal in Pos Aggregates
   */
  async getUnreconciledStatements(bankAccountId?: number): Promise<any[]> {
    try {
      // Get today's date as default
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1); // Start of month
      const endDate = today;

      let statements: any[];

      if (bankAccountId) {
        statements = await this.repository.getUnreconciledBatch(
          startDate,
          endDate,
          10000, // Large limit
          0,
          bankAccountId
        );
      } else {
        // Get from all accounts - we need to fetch all
        const accounts = await this.repository.getAllBankAccounts();
        const allStatements: any[] = [];

        for (const account of accounts) {
          const accountStatements = await this.repository.getUnreconciledBatch(
            startDate,
            endDate,
            10000,
            0,
            account.id
          );
          allStatements.push(...accountStatements);
        }

        statements = allStatements;
      }

      // Transform to include computed fields
      return statements.map(s => {
        const bankAmount = (s.credit_amount || 0) - (s.debit_amount || 0);
        return {
          ...s,
          amount: bankAmount,
          status: BankReconciliationStatus.UNRECONCILED,
          is_reconciled: false,
          matched_aggregate: null,
          potentialMatches: [],
        };
      });
    } catch (error: any) {
      logError("Error getting unreconciled statements for reverse matching", {
        bankAccountId,
        error: error.message
      });
      throw new Error("Gagal mengambil data mutasi bank yang belum dicocokkan");
    }
  }

  /**
   * Find bank statements by amount (for reverse matching)
   * Searches for statements with similar amounts to help match with POS aggregates
   */
  async findStatementsByAmount(
    targetAmount: number,
    tolerancePercent: number = 0.05 // 5% default tolerance
  ): Promise<any[]> {
    try {
      // Get today's date as default
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1); // Start of month
      const endDate = today;

      // Get all unreconciled statements
      const accounts = await this.repository.getAllBankAccounts();
      const allStatements: any[] = [];

      for (const account of accounts) {
        const accountStatements = await this.repository.getUnreconciledBatch(
          startDate,
          endDate,
          10000,
          0,
          account.id
        );
        allStatements.push(...accountStatements);
      }

      // Calculate tolerance
      const tolerance = targetAmount * tolerancePercent;
      const minAmount = targetAmount - tolerance;
      const maxAmount = targetAmount + tolerance;

      // Filter statements by amount range
      const matchingStatements = allStatements.filter(s => {
        const bankAmount = (s.credit_amount || 0) - (s.debit_amount || 0);
        return bankAmount >= minAmount && bankAmount <= maxAmount;
      });

      // Sort by closest match first
      matchingStatements.sort((a, b) => {
        const amountA = Math.abs(((a.credit_amount || 0) - (a.debit_amount || 0)) - targetAmount);
        const amountB = Math.abs(((b.credit_amount || 0) - (b.debit_amount || 0)) - targetAmount);
        return amountA - amountB;
      });

      // Limit results
      const limitedResults = matchingStatements.slice(0, 50);

      // Transform to include computed fields
      return limitedResults.map(s => {
        const bankAmount = (s.credit_amount || 0) - (s.debit_amount || 0);
        const difference = Math.abs(bankAmount - targetAmount);
        const matchPercentage = 1 - (difference / targetAmount);

        return {
          ...s,
          amount: bankAmount,
          targetAmount,
          difference,
          matchPercentage: Math.round(matchPercentage * 100) / 100,
          status: BankReconciliationStatus.UNRECONCILED,
          is_reconciled: false,
          matched_aggregate: null,
          potentialMatches: [],
        };
      });
    } catch (error: any) {
      logError("Error finding statements by amount", {
        targetAmount,
        tolerancePercent,
        error: error.message
      });
      throw new Error("Gagal mencari mutasi bank berdasarkan nominal");
    }
  }
}

export const bankReconciliationService = new BankReconciliationService(
  bankReconciliationRepository,
  reconciliationOrchestratorService,
  feeReconciliationService,
);
