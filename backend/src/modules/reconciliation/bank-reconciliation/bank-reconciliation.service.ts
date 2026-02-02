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

  /**
   * Configuration for multi-match
   */
  private readonly multiMatchConfig = {
    defaultTolerancePercent: 0.05, // 5%
    defaultDateToleranceDays: 2,
    defaultMaxStatements: 5,
    differenceThreshold: 100, // Rp 100 tolerance
  };

  constructor(
    private readonly repository: BankReconciliationRepository,
    private readonly orchestratorService: IReconciliationOrchestratorService,
    private readonly feeReconciliationService: FeeReconciliationService,
  ) {}

  /**
   * Reconcile a single POS aggregate with a bank statement
   */
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

    // 1. Mark as reconciled in DB
    await this.repository.markAsReconciled(statementId, aggregateId);

    // 2. Update status in POS Aggregates (Bidirectional sync)
    await this.orchestratorService.updateReconciliationStatus(
      aggregateId,
      "RECONCILED",
      statementId,
      userId,
    );

    // 3. Audit Trail
    await this.repository.logAction({
      companyId: statement.company_id,
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

  /**
   * Undo reconciliation for a statement
   */
  async undo(statementId: string, userId?: string): Promise<void> {
    const statement = await this.repository.findById(statementId);
    if (!statement) {
      throw new Error("Bank statement not found");
    }

    await this.repository.undoReconciliation(statementId);

    // Update status in POS Aggregates (Reset to PENDING)
    if (statement.reconciliation_id) {
      await this.orchestratorService.updateReconciliationStatus(
        statement.reconciliation_id,
        "PENDING",
      );
    }

    // Audit Trail
    await this.repository.logAction({
      companyId: statement.company_id,
      userId,
      action: "UNDO",
      statementId,
      aggregateId: statement.reconciliation_id,
      details: {},
    });
  }

  /**
   * Auto-match multiple aggregates with statements using tiered priority logic
   */
  async autoMatch(
    companyId: string,
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

    // 1. Get unreconciled statements (possibly in batches)
    const statements = await this.repository.getUnreconciledBatch(
      companyId,
      startDate,
      endDate,
      this.config.autoMatchBatchSize,
      0,
      bankAccountId,
    );

    // 2. Get aggregates (expected net) from orchestrator
    // Expand date range to include date buffer for fuzzy matching
    const bufferStart = new Date(startDate);
    bufferStart.setDate(bufferStart.getDate() - matchingCriteria.dateBufferDays);
    const bufferEnd = new Date(endDate);
    bufferEnd.setDate(bufferEnd.getDate() + matchingCriteria.dateBufferDays);

    const aggregates = await this.orchestratorService.getAggregatesByDateRange(
      companyId,
      bufferStart,
      bufferEnd,
    );

    const matches: ReconciliationMatch[] = [];
    const remainingStatements = [...statements];
    const remainingAggregates = [...aggregates];

    // Priority 1: Exact Reference Number Match
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

// Priority 2: Amount + Exact Date
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

    // Priority 3: Amount + Date Buffer
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

    // 5. Apply matches and log them
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
        companyId,
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

    // Bulk update POS aggregates
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
   * Helper to process matching logic for a specific priority tiered approach
   */
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

  /**
   * Get all bank statements for a period with reconciliation info
   */
  async getStatements(
    companyId: string,
    startDate: Date,
    endDate: Date,
    bankAccountId?: number,
  ): Promise<any[]> {
    const statements = await this.repository.getByDateRange(
      companyId,
      startDate,
      endDate,
      bankAccountId,
    );

    return statements.map((s) => {
      const isReconciled = s.is_reconciled;
      const bankAmount = s.credit_amount - s.debit_amount;
      const hasMatch = !!s.matched_aggregate;
      const difference = hasMatch
        ? Math.abs(bankAmount - s.matched_aggregate.nett_amount)
        : 0;

      // Determine status based on reconciliation state
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

      return {
        ...s,
        amount: bankAmount,
        status,
        potentialMatches: [],
      };
    });
  }

  /**
   * Fetch potential matches for a single bank statement
   */
  async getPotentialMatches(
    companyId: string,
    statementId: string,
  ): Promise<any[]> {
    const s = await this.repository.findById(statementId);
    if (!s) throw new Error("Statement not found");

    const sAmount = s.credit_amount - s.debit_amount;
    return this.orchestratorService.findPotentialAggregatesForStatement(
      companyId,
      sAmount,
      new Date(s.transaction_date),
      this.config.amountTolerance,
      this.config.dateBufferDays,
    );
  }

  /**
   * Get reconciliation summary per bank account
   */
  async getBankAccountsStatus(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.repository.getBankAccountsStatus(companyId, startDate, endDate);
  }

  /**
   * Get reconciliation summary
   */
  async getSummary(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    return this.orchestratorService.getReconciliationSummary(
      companyId,
      startDate,
      endDate,
    );
  }

  /**
   * Calculate difference between POS and bank
   */
  calculateDifference(
    aggregateAmount: number,
    statementAmount: number,
  ): { absolute: number; percentage: number } {
    const absolute = Math.abs(aggregateAmount - statementAmount);
    const percentage =
      aggregateAmount !== 0 ? (absolute / aggregateAmount) * 100 : 0;

    return { absolute, percentage };
  }

  // =====================================================
  // MULTI-MATCH SERVICE METHODS
  // =====================================================

  /**
   * Create multi-match: 1 POS Aggregate with N Bank Statements
   */
  async createMultiMatch(
    companyId: string,
    aggregateId: string,
    statementIds: string[],
    userId?: string,
    notes?: string,
    overrideDifference?: boolean,
  ): Promise<MultiMatchResultDto> {
    // 1. Validate aggregate exists and is unreconciled
    const aggregate = await this.orchestratorService.getAggregate(aggregateId);
    if (!aggregate) {
      throw new Error("Aggregate tidak ditemukan");
    }

    const existingGroup = await this.repository.isAggregateInGroup(aggregateId);
    if (existingGroup) {
      throw new Error("Aggregate sudah menjadi bagian dari group");
    }

    // 2. Validate all statements exist and are unreconciled
    const statements = await Promise.all(
      statementIds.map(id => this.repository.findById(id))
    );

    const invalidStatements = statements.filter(
      (s) => !s || s.company_id !== companyId || s.is_reconciled
    );
    if (invalidStatements.length > 0) {
      throw new Error("Beberapa statement tidak valid atau sudah dicocokkan");
    }

    // 3. Calculate totals
    const totalBankAmount = statements.reduce((sum, s) => {
      const amount = (s.credit_amount || 0) - (s.debit_amount || 0);
      return sum + amount;
    }, 0);

    const aggregateAmount = aggregate.nett_amount;
    const difference = totalBankAmount - aggregateAmount;
    const differencePercent = aggregateAmount !== 0
      ? Math.abs(difference) / aggregateAmount
      : 0;

    // 4. Check if difference is within tolerance OR override is true
    const isWithinTolerance = differencePercent <= this.multiMatchConfig.defaultTolerancePercent;
    if (!isWithinTolerance && !overrideDifference) {
      throw new Error(
        `Selisih ${(differencePercent * 100).toFixed(2)}% melebihi tolerance ${(this.multiMatchConfig.defaultTolerancePercent * 100)}%. Gunakan override jika ingin melanjutkan.`
      );
    }

    // 5. Create reconciliation group
    const groupId = await this.repository.createReconciliationGroup({
      companyId,
      aggregateId,
      statementIds,
      totalBankAmount,
      aggregateAmount,
      difference,
      notes,
      reconciledBy: userId,
    });

    // 6. Create group details
    const statementDetails = statements.map(s => ({
      statementId: s.id,
      amount: (s.credit_amount || 0) - (s.debit_amount || 0),
    }));
    await this.repository.addStatementsToGroup(groupId, statementDetails);

    // 7. Mark all statements as reconciled with group
    await this.repository.markStatementsAsReconciledWithGroup(statementIds, groupId);

    // 8. Update aggregate reconciliation status
    await this.orchestratorService.updateReconciliationStatus(
      aggregateId,
      "RECONCILED",
      undefined,
      userId,
    );

    // 9. Log audit trail
    await this.repository.logAction({
      companyId,
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

  /**
   * Undo multi-match
   */
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

    // Undo di repository
    await this.repository.undoReconciliationGroup(groupId);

    // Reset aggregate status
    if (group.aggregate_id) {
      await this.orchestratorService.updateReconciliationStatus(
        group.aggregate_id,
        "PENDING",
      );
    }

    // Audit trail
    await this.repository.logAction({
      companyId: group.company_id,
      userId,
      action: "UNDO" as any,
      aggregateId: group.aggregate_id,
      details: {
        groupId,
        isMultiMatchUndo: true,
      },
    });
  }

  /**
   * Get suggested statements for grouping
   */
  async getSuggestedGroupStatements(
    companyId: string,
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

    // Get date range with tolerance
    const aggregateDate = new Date(aggregate.transaction_date);
    const startDate = new Date(aggregateDate);
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date(aggregateDate);
    endDate.setDate(endDate.getDate() + days);

    // Get candidate statements
    const statements = await this.repository.getUnreconciledStatementsForSuggestion(
      companyId,
      startDate,
      endDate,
    );

    // Run suggestion algorithm
    const suggestions = this.findStatementCombinations(
      statements,
      aggregate.nett_amount,
      tolerance,
      max,
    );

    return suggestions;
  }

  /**
   * Knapsack-style algorithm to find statement combinations
   */
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

    // Group by MID if available
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

    // Priority 1: Find combinations with same MID
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

    // Priority 2: Fallback - find combinations without MID
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

    // Sort by confidence and match percentage
    return suggestions.sort((a, b) => {
      const confidenceOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      }
      return b.matchPercentage - a.matchPercentage;
    });
  }

  /**
   * Find combinations that match target amount within tolerance
   */
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

    // Simple recursive combination finder (optimized for small N)
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

    // Sort by closeness to target
    return results.sort((a, b) => {
      const sumA = a.reduce((s: number, st: any) => s + st.amount, 0);
      const sumB = b.reduce((s: number, st: any) => s + st.amount, 0);
      return Math.abs(sumA - targetAmount) - Math.abs(sumB - targetAmount);
    }).slice(0, 10);
  }

  /**
   * Extract MID from description
   */
  private extractMID(description: string): string | null {
    const midRegex = /MID[:\s]*([0-9]+)/i;
    const match = description.match(midRegex);
    return match ? match[1] : null;
  }

  /**
   * Get all reconciliation groups
   */
  async getReconciliationGroups(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.repository.getReconciliationGroups(companyId, startDate, endDate);
  }

  /**
   * Get single group with details
   */
  async getMultiMatchGroup(groupId: string): Promise<any> {
    return this.repository.getReconciliationGroupById(groupId);
  }
}

export const bankReconciliationService = new BankReconciliationService(
  bankReconciliationRepository,
  reconciliationOrchestratorService,
  feeReconciliationService,
);
