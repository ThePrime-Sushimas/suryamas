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
} from "./bank-reconciliation.errors";
import { getReconciliationConfig } from "./bank-reconciliation.config";
import { IReconciliationOrchestratorService } from "../orchestrator/reconciliation-orchestrator.types";
import {
  FeeReconciliationService,
  feeReconciliationService,
} from "../fee-reconciliation/fee-reconciliation.service";
import { reconciliationOrchestratorService } from "../orchestrator/reconciliation-orchestrator.service";
import { logError, logInfo } from "../../../config/logger";
import { createPaginatedResponse } from "../../../utils/pagination.util";
import { AuditService } from "../../monitoring/monitoring.service";
import { cashCountsRepository } from "../../cash-counts/cash-counts.repository";
import { settlementGroupService } from "../bank-settlement-group/bank-settlement-group.service";
import { settlementGroupRepository } from "../bank-settlement-group/bank-settlement-group.repository";
import type {
  MatchingStrategy,
  MatchingEngineResult
} from "./bank-reconciliation.types";

export class BankReconciliationService {

  private readonly config = getReconciliationConfig();

  private readonly descriptionKeywordMap: Record<string, string[]> = {
    'grabfood':   ['visionet'],           // ✅ "VISIONET INTERNASI..."
    'shopeefood': ['airpay'],             // ✅ "AIRPAY INTERNATION..."
    'gofood':     ['dompet anak bangsa'], // ✅ "DOMPET ANAK BANGSA"
  };

  private matchesByKeyword(
    statementDescription: string,
    aggregatePaymentMethod: string,
  ): boolean {
    const desc = statementDescription.toLowerCase();
    const method = aggregatePaymentMethod.toLowerCase();
    for (const [paymentMethod, keywords] of Object.entries(this.descriptionKeywordMap)) {
      if (method.includes(paymentMethod)) {
        if (keywords.some(kw => desc.includes(kw))) {
          return true;
        }
      }
    }
    return false;
  }
  private readonly multiMatchConfig = {
    defaultTolerancePercent: 0.05,
    defaultDateToleranceDays: 2,
    defaultMaxStatements: 5,
    differenceThreshold: 100,
  };

  // ==================== MATCHING ENGINE ====================

  /**
   * Core matching strategies - single source of truth
   */
  private readonly MATCHING_STRATEGIES: MatchingStrategy[] = [
    {
      name: 'EXACT_REF',
      score: 100,
      predicate: (s: any, a: any, criteria: MatchingCriteria) =>
        Boolean(s.reference_number && a.reference_number && s.reference_number === a.reference_number)
    },
    {
      name: 'EXACT_AMOUNT_DATE',
      score: 90,
      predicate: (s: any, a: any, criteria: MatchingCriteria) => {
        const sAmount = s.credit_amount - s.debit_amount;
        const sDate = new Date(s.transaction_date).toDateString();
        const aDate = new Date(a.transaction_date).toDateString();
        return (
          Math.abs(sAmount - a.nett_amount) <= criteria.amountTolerance &&
          sDate === aDate
        );
      }
    },
    {
      name: 'KEYWORD_DESC',
      score: 85,
      predicate: (s: any, a: any, criteria: MatchingCriteria) => {
        const sAmount = s.credit_amount - s.debit_amount;
        const amountOk = Math.abs(sAmount - a.nett_amount) <= criteria.amountTolerance;
        const keywordOk = this.matchesByKeyword(s.description || '', a.payment_method_name || '');
        return amountOk && keywordOk;
      }
    },
    {
      name: 'FUZZY_AMOUNT_DATE',
      score: 80,
      predicate: (s: any, a: any, criteria: MatchingCriteria) => {
        const sAmount = s.credit_amount - s.debit_amount;
        const sDate = new Date(s.transaction_date).getTime();
        const aDate = new Date(a.transaction_date).getTime();
        const dayDiff = Math.abs(sDate - aDate) / (1000 * 3600 * 24);
        return (
          Math.abs(sAmount - a.nett_amount) <= criteria.amountTolerance &&
          dayDiff <= criteria.dateBufferDays
        );
      }
    }
  ];

  /**
   * Core matching engine - used by autoMatch, previewAutoMatch, confirmAutoMatch
   * @param statements - unreconciled bank statements
   * @param aggregates - available POS aggregates  
   * @param criteria - matching tolerance parameters
   * @param mode - 'preview' returns detailed results, 'execute' mutates arrays
   * @returns MatchingEngineResult
   */
  private runMatchingEngine(
    statements: any[],
    aggregates: any[],
    criteria: MatchingCriteria,
    mode: 'preview' | 'execute'
  ): MatchingEngineResult {
    // Clone arrays to avoid mutating originals in preview mode
    let remainingStatements = mode === 'preview' ? [...statements] : statements;
    let remainingAggregates = mode === 'preview' ? [...aggregates] : aggregates;
    
    const matches: ReconciliationMatch[] = [];
    
    // Skip reconciled aggregates in execute mode
    if (mode === 'execute') {
      remainingAggregates = remainingAggregates.filter(
        a => a.reconciliation_status !== 'RECONCILED'
      );
    }

    // Apply all strategies in order

    for (const strategy of this.MATCHING_STRATEGIES) {
      for (let i = remainingStatements.length - 1; i >= 0; i--) {
        const stmt = remainingStatements[i];
        const matchIdx = remainingAggregates.findIndex(agg => 
          strategy.predicate(stmt, agg, criteria)
        );

        if (matchIdx !== -1) {
          const agg = remainingAggregates[matchIdx];
          
          const match: ReconciliationMatch = {
            statementId: stmt.id,
            aggregateId: agg.id,
            matchScore: strategy.score,
            matchCriteria: strategy.name as any,
            difference: Math.abs((stmt.credit_amount - stmt.debit_amount) - agg.nett_amount)
          };

          if (mode === 'execute') {
            matches.push(match);
            remainingStatements.splice(i, 1);
            remainingAggregates.splice(matchIdx, 1);
          } else {
            // Preview mode: detailed match info
            (matches as any[]).push({
              statementId: stmt.id,
              statement: {
                id: stmt.id,
                transaction_date: stmt.transaction_date,
                description: stmt.description,
                reference_number: stmt.reference_number,
                debit_amount: stmt.debit_amount,
                credit_amount: stmt.credit_amount,
                amount: stmt.credit_amount - stmt.debit_amount
              },
              aggregate: {
                id: agg.id,
                transaction_date: agg.transaction_date,
                nett_amount: agg.nett_amount,
                reference_number: agg.reference_number,
                payment_method_name: agg.payment_method_name,
                gross_amount: agg.gross_amount,
                branch_name: agg.branch_name || null
              },
              matchScore: strategy.score,
              matchCriteria: strategy.name,
              difference: match.difference
            });
            
            remainingStatements.splice(i, 1);
            remainingAggregates.splice(matchIdx, 1);
          }
        }
      }
    }

    if (mode === 'execute') {
      return { mode: 'execute', matches };
    } else {
      // Preview: adjust FUZZY scores + sort + build full response
      const previewMatches = (matches as any[]).map((m: any) => {
        let adjustedScore = m.matchScore;
        if (m.matchCriteria === 'FUZZY_AMOUNT_DATE') {
          const stmtAmount = m.statement.amount;
          const amountDiff = m.difference;
          const stmtDate = new Date(m.statement.transaction_date).getTime();
          const aggDate = new Date(m.aggregate.transaction_date).getTime();
          const dayDiff = Math.abs(stmtDate - aggDate) / (1000 * 3600 * 24);

          if (amountDiff === 0) {
            adjustedScore = 95 - dayDiff * 5;
          } else {
            const amountPenalty = (amountDiff / (stmtAmount || 1)) * 100;
            adjustedScore = 80 - amountPenalty - dayDiff * 5;
          }
          adjustedScore = Math.max(0, Math.min(100, Math.round(adjustedScore)));
        }
        return { ...m, matchScore: adjustedScore };
      }).sort((a: any, b: any) => b.matchScore - a.matchScore);

      return {
        mode: 'preview',
        matches: previewMatches,
        summary: {
          totalStatements: statements.length,
          matchedStatements: previewMatches.length,
          unmatchedStatements: remainingStatements.length
        },
        unmatchedStatements: remainingStatements.map((s: any) => ({
          id: s.id,
          transaction_date: s.transaction_date,
          description: s.description,
          reference_number: s.reference_number,
          debit_amount: s.debit_amount,
          credit_amount: s.credit_amount,
          amount: s.credit_amount - s.debit_amount
        }))
      };
    }
  }

  constructor(
    private readonly repository: BankReconciliationRepository,
    private readonly orchestratorService: IReconciliationOrchestratorService,
    private readonly feeReconciliationService: FeeReconciliationService,
  ) {}


  async reconcileCashDeposit(
    cashDepositId: string,
    statementId: string,
    userId?: string,
    companyId?: string,
    notes?: string,
  ): Promise<any> {
    const statement = await this.repository.findById(statementId);
    if (!statement) throw new Error("Bank statement not found");
    if (statement.is_reconciled) throw new AlreadyReconciledError(statementId);

    const deposit = await cashCountsRepository.findDepositById(cashDepositId);
    if (!deposit) throw new Error("Cash deposit not found");
    if (deposit.status === 'RECONCILED') throw new Error("Cash deposit sudah reconciled");
    if (deposit.status !== 'DEPOSITED') throw new Error(`Cash deposit status ${deposit.status}, harus DEPOSITED`);

    await this.repository.markAsReconciledCashDeposit(statementId, cashDepositId, userId);
    await cashCountsRepository.reconcileDeposit(cashDepositId, statementId);

    await this.repository.logAction({
      companyId: companyId || statement.company_id,
      userId,
      action: "AUTO_MATCH_CASH_DEPOSIT",
      statementId,
      details: { cashDepositId, depositAmount: deposit.deposit_amount, notes },
    });

    if (userId) {
      await AuditService.log('CREATE', 'bank_reconciliation', statementId, userId,
        { is_reconciled: false },
        { is_reconciled: true, cashDepositId, notes },
      );
    }

    return { success: true, statementId, cashDepositId, notes };
  }

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

    await this.repository.markAsReconciled(statementId, aggregateId, userId);
    await this.feeReconciliationService.calculateAndSaveFeeDiscrepancy(
      aggregateId,
      statementId,
    );
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

    // Audit log for MANUAL_RECONCILE
    if (userId) {
      await AuditService.log('CREATE', 'bank_reconciliation', statementId, userId, 
        { is_reconciled: false }, 
        { is_reconciled: true, aggregateId, notes }
      )
    }

    // Auto-generate draft voucher
    const stmtDate = typeof statement.transaction_date === 'string'
      ? statement.transaction_date.slice(0, 10)
      : new Date(statement.transaction_date).toISOString().slice(0, 10);

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
    if (!statement) throw new Error("Bank statement not found");
  
    // ── Cash deposit undo ──
    if (statement.cash_deposit_id) {
      await cashCountsRepository.unreconciledDeposit(statement.cash_deposit_id);
      await this.repository.undoCashDepositReconciliation(statementId, statement.cash_deposit_id, userId);

      await this.repository.logAction({
        companyId: companyId || statement.company_id,
        userId,
        action: "UNDO_CASH_DEPOSIT",
        statementId,
        details: { cashDepositId: statement.cash_deposit_id },
      });

      if (userId) {
        await AuditService.log('DELETE', 'bank_reconciliation', statementId, userId,
          { is_reconciled: true, cash_deposit_id: statement.cash_deposit_id },
          { is_reconciled: false }
        );
      }
      return;
    }

    // ── Settlement group undo ──
    // Detect if this statement belongs to a settlement group (1 statement → many aggregates)
    const settlementGroup = await settlementGroupRepository.findByBankStatementId(statementId);
    if (settlementGroup) {
      logInfo("Undo detected settlement group, delegating to deleteSettlementGroup", {
        statementId,
        settlementGroupId: settlementGroup.id,
      });
      await settlementGroupService.deleteSettlementGroup(settlementGroup.id, userId);

      await this.repository.logAction({
        companyId: companyId || statement.company_id,
        userId,
        action: "UNDO",
        statementId,
        details: { settlementGroupId: settlementGroup.id, undoType: "SETTLEMENT_GROUP" },
      });

      if (userId) {
        await AuditService.log('DELETE', 'bank_reconciliation', statementId, userId,
          { is_reconciled: true, settlement_group_id: settlementGroup.id },
          { is_reconciled: false }
        );
      }
      return;
    }

    // ── Aggregate undo (existing logic) ──
    let aggregateId = statement.reconciliation_id;
    let isMultiMatch = false;
  
    if (!aggregateId && statement.reconciliation_group_id) {
      const group = await this.repository.getReconciliationGroupById(
        statement.reconciliation_group_id
      );
      aggregateId = group?.aggregate_id ?? null;
      isMultiMatch = true;
    }
  
    // Reset statement ini
    await this.repository.undoReconciliation(statementId, userId);
  
    if (aggregateId) {
      if (isMultiMatch) {
        // Cek apakah masih ada statement lain di group yang belum di-undo
        const remainingReconciled = await this.repository
          .countReconciledStatementsInGroup(statement.reconciliation_group_id!);
        
        // Baru update aggregate kalau semua sudah di-undo
        if (remainingReconciled === 0) {
          await this.feeReconciliationService.resetFeeDiscrepancy(aggregateId);
          await this.orchestratorService.updateReconciliationStatus(aggregateId, "PENDING");
          await this.repository.softDeleteGroup(statement.reconciliation_group_id!);
        }
      } else {
        // Manual/auto reconcile — langsung reset
        await this.feeReconciliationService.resetFeeDiscrepancy(aggregateId);
        await this.orchestratorService.updateReconciliationStatus(aggregateId, "PENDING");
      }
    }
  
    await this.repository.logAction({
      companyId: companyId || statement.company_id,
      userId,
      action: "UNDO",
      statementId,
      aggregateId,
      details: {},
    });
  
    if (userId) {
      await AuditService.log('DELETE', 'bank_reconciliation', statementId, userId,
        { is_reconciled: true, reconciliation_id: statement.reconciliation_id },
        { is_reconciled: false }
      );
    }
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
    bufferStart.setDate(
      bufferStart.getDate() - matchingCriteria.dateBufferDays,
    );
    const bufferEnd = new Date(endDate);
    bufferEnd.setDate(bufferEnd.getDate() + matchingCriteria.dateBufferDays);

    const aggregates = await this.orchestratorService.getAggregatesByDateRange(
      bufferStart,
      bufferEnd,
    );

    // 🔥 REFACTORED: Use matching engine
    const engineResult = this.runMatchingEngine(
      statements,
      aggregates,
      matchingCriteria,
      'execute'
    ) as { matches: ReconciliationMatch[] };

    const matches = engineResult.matches;

    const bulkUpdates: any[] = [];
    for (const match of matches) {
      await this.repository.markAsReconciled(
        match.statementId,
        match.aggregateId,
        userId,
      );
      await this.feeReconciliationService.calculateAndSaveFeeDiscrepancy(
        match.aggregateId,
        match.statementId,
      );
    
      bulkUpdates.push({
        aggregateId: match.aggregateId,
        status: "RECONCILED",
        statementId: match.statementId,
      });

      await this.repository.logAction({
        companyId: companyId || "",
        userId,
        action: "AUTO_MATCH",
        statementId: match.statementId,
        aggregateId: match.aggregateId,
        details: {
          matchScore: match.matchScore,
          matchCriteria: match.matchCriteria,
        },
      });

      // Audit log for AUTO_MATCH
      if (userId) {
        await AuditService.log('CREATE', 'bank_reconciliation', match.statementId, userId, 
          { is_reconciled: false }, 
          { is_reconciled: true, aggregateId: match.aggregateId, matchScore: match.matchScore }
        )
      }
    }

    if (bulkUpdates.length > 0) {
      await this.orchestratorService.bulkUpdateReconciliationStatus(
        bulkUpdates,
      );
    }

    // ── Cash Deposit Matching ──────────────────────────────────────
    // Match remaining unreconciled statements against DEPOSITED cash deposits
    const remainingStatements = statements.filter(
      (s: any) => !matches.find((m) => m.statementId === s.id)
    );

    let cashDepositMatches = 0;
    if (remainingStatements.length > 0) {
      const startDateStr = bufferStart.toISOString().split("T")[0];
      const endDateStr = bufferEnd.toISOString().split("T")[0];
      const deposits = await cashCountsRepository.getDepositedForMatch(
        startDateStr, endDateStr, bankAccountId,
      );

      for (let i = remainingStatements.length - 1; i >= 0; i--) {
        const stmt = remainingStatements[i];
        const stmtAmount = stmt.credit_amount - stmt.debit_amount;
        if (stmtAmount <= 0) continue; // Cash deposit = credit only

        const stmtDate = new Date(stmt.transaction_date).getTime();

        const depIdx = deposits.findIndex((dep) => {
          const depDate = new Date(dep.deposited_at || dep.deposit_date).getTime();
          const dayDiff = Math.abs(stmtDate - depDate) / (1000 * 3600 * 24);
          return (
            Math.abs(stmtAmount - dep.deposit_amount) <= matchingCriteria.amountTolerance &&
            dayDiff <= matchingCriteria.dateBufferDays
          );
        });

        if (depIdx !== -1) {
          const dep = deposits[depIdx];
          try {
            await this.repository.markAsReconciledCashDeposit(stmt.id, dep.id, userId);
            await cashCountsRepository.reconcileDeposit(dep.id, stmt.id);

            await this.repository.logAction({
              companyId: companyId || "",
              userId,
              action: "AUTO_MATCH_CASH_DEPOSIT",
              statementId: stmt.id,
              details: { cashDepositId: dep.id, depositAmount: dep.deposit_amount },
            });

            if (userId) {
              await AuditService.log('CREATE', 'bank_reconciliation', stmt.id, userId,
                { is_reconciled: false },
                { is_reconciled: true, cashDepositId: dep.id },
              );
            }

            cashDepositMatches++;
            deposits.splice(depIdx, 1);
            remainingStatements.splice(i, 1);
          } catch (err: any) {
            logError("Cash deposit auto-match failed", {
              statementId: stmt.id, depositId: dep.id, error: err.message,
            });
          }
        }
      }

      if (cashDepositMatches > 0) {
        logInfo("Cash deposit auto-match complete", {
          matched: cashDepositMatches, remaining: remainingStatements.length,
        });
      }
    }

    return {
      matched: matches.length + cashDepositMatches,
      matchedAggregates: matches.length,
      matchedCashDeposits: cashDepositMatches,
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
    bufferStart.setDate(
      bufferStart.getDate() - matchingCriteria.dateBufferDays,
    );
    const bufferEnd = new Date(endDate);
    bufferEnd.setDate(bufferEnd.getDate() + matchingCriteria.dateBufferDays);

    const aggregates = await this.orchestratorService.getAggregatesByDateRange(
      bufferStart,
      bufferEnd,
    );

    // 🔥 REFACTORED: Use matching engine
    const result = this.runMatchingEngine(
      statements,
      aggregates,
      matchingCriteria,
      'preview'
    ) as Extract<MatchingEngineResult, { mode: 'preview' }>;

    // ── Cash Deposit Preview Matching ──
    const remainingStmts = result.unmatchedStatements || [];
    const cashDepositMatches: any[] = [];

    if (remainingStmts.length > 0) {
      const startDateStr = bufferStart.toISOString().split("T")[0];
      const endDateStr = bufferEnd.toISOString().split("T")[0];
      const deposits = await cashCountsRepository.getDepositedForMatch(
        startDateStr, endDateStr, bankAccountId,
      );

      const remainingDeposits = [...deposits];
      for (let i = remainingStmts.length - 1; i >= 0; i--) {
        const stmt = remainingStmts[i];
        const stmtAmount = stmt.amount ?? ((stmt.credit_amount || 0) - (stmt.debit_amount || 0));
        if (stmtAmount <= 0) continue;

        const stmtDate = new Date(stmt.transaction_date).getTime();

        const depIdx = remainingDeposits.findIndex((dep) => {
          const depDate = new Date(dep.deposited_at || dep.deposit_date).getTime();
          const dayDiff = Math.abs(stmtDate - depDate) / (1000 * 3600 * 24);
          const cashTolerance = Math.max(matchingCriteria.amountTolerance, dep.deposit_amount * 0.005);
          return (
            Math.abs(stmtAmount - dep.deposit_amount) <= cashTolerance &&
            dayDiff <= matchingCriteria.dateBufferDays
          );
        });

        if (depIdx !== -1) {
          const dep = remainingDeposits[depIdx];
          cashDepositMatches.push({
            statementId: stmt.id,
            statement: stmt,
            cashDeposit: {
              id: dep.id,
              deposit_date: dep.deposit_date,
              deposit_amount: dep.deposit_amount,
              branch_name: dep.branch_name,
              bank_account_id: dep.bank_account_id,
            },
            matchScore: 90,
            matchCriteria: 'CASH_DEPOSIT',
            difference: Math.abs(stmtAmount - dep.deposit_amount),
          });
          remainingDeposits.splice(depIdx, 1);
          remainingStmts.splice(i, 1);
        }
      }
    }

    // Merge cash deposit matches into matches array with unified format
    const mergedCashDepositMatches = cashDepositMatches.map((m: any) => ({
      statementId: m.statementId,
      statement: m.statement,
      aggregate: {
        id: m.cashDeposit.id,
        transaction_date: m.cashDeposit.deposit_date,
        nett_amount: m.cashDeposit.deposit_amount,
        payment_method_name: "Setoran Tunai",
        branch_name: m.cashDeposit.branch_name,
        gross_amount: m.cashDeposit.deposit_amount,
      },
      matchScore: m.matchScore,
      matchCriteria: 'CASH_DEPOSIT',
      difference: m.difference,
    }));

    const allMatches = [...result.matches, ...mergedCashDepositMatches];

    return {
      matches: allMatches,
      summary: {
        ...result.summary,
        matchedCashDeposits: cashDepositMatches.length,
        matchedStatements: allMatches.length,
        unmatchedStatements: remainingStmts.length,
      },
      unmatchedStatements: remainingStmts,
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
    preMatchedPairs?: Array<{ statementId: string; aggregateId: string; matchCriteria?: string }>,
  ): Promise<any> {
    const matchingCriteria = {
      amountTolerance: this.config.amountTolerance,
      dateBufferDays: this.config.dateBufferDays,
      ...criteria,
    };
  
    // 1. Get selected statements
    const statements = (
      await Promise.all(statementIds.map((id) => this.repository.findById(id)))
    ).filter((s) => s && !s.is_reconciled);
  
    if (statements.length === 0) {
      return { matched: 0, failed: 0, matches: [] };
    }

    let matches: ReconciliationMatch[];

    // Compute date buffer for cash deposit matching (needed regardless of path)
    const minDate = new Date(
      Math.min(...statements.map((s: any) => new Date(s.transaction_date).getTime()))
    );
    const maxDate = new Date(
      Math.max(...statements.map((s: any) => new Date(s.transaction_date).getTime()))
    );
    const bufferStart = new Date(minDate);
    bufferStart.setDate(bufferStart.getDate() - matchingCriteria.dateBufferDays);
    const bufferEnd = new Date(maxDate);
    bufferEnd.setDate(bufferEnd.getDate() + matchingCriteria.dateBufferDays);

    if (preMatchedPairs && preMatchedPairs.length > 0) {
      // Use pre-matched pairs from preview — skip re-matching
      const validStatementIds = new Set(statements.map((s: any) => String(s.id)));
      matches = preMatchedPairs
        .filter((p) => validStatementIds.has(String(p.statementId)))
        .map((p) => ({
          statementId: String(p.statementId),
          aggregateId: String(p.aggregateId),
          matchScore: 100,
          matchCriteria: (p.matchCriteria || 'EXACT_AMOUNT_DATE') as any,
          difference: 0,
        }));
    } else {
      // Fallback: re-run matching engine
      const aggregates = await this.orchestratorService.getAggregatesByDateRange(
        bufferStart,
        bufferEnd,
      );

      const engineResult = this.runMatchingEngine(
        statements,
        aggregates,
        matchingCriteria,
        'execute'
      ) as { matches: ReconciliationMatch[] };

      matches = engineResult.matches;
    }
  
    // Execute reconciliation for matches
    const successMatches: ReconciliationMatch[] = [];
  
    for (const match of matches) {
      try {
        await this.repository.markAsReconciled(
          match.statementId,
          match.aggregateId,
          userId,
        );
        await this.feeReconciliationService.calculateAndSaveFeeDiscrepancy(
          match.aggregateId,
          match.statementId,
        );
        await this.repository.logAction({
          companyId: companyId || "",
          userId,
          action: "AUTO_MATCH",
          statementId: match.statementId,
          aggregateId: match.aggregateId,
          details: {
            matchScore: match.matchScore,
            matchCriteria: match.matchCriteria,
          },
        });
  
        if (userId) {
          await AuditService.log(
            "CREATE",
            "bank_reconciliation",
            match.statementId,
            userId,
            { is_reconciled: false },
            {
              is_reconciled: true,
              aggregateId: match.aggregateId,
              matchScore: match.matchScore,
            },
          );
        }
  
        successMatches.push(match);
      } catch (error: any) {
        logError("Error reconciling match", {
          statementId: match.statementId,
          aggregateId: match.aggregateId,
          error: error.message,
        });
      }
    }

    // Update aggregate reconciliation status
    if (successMatches.length > 0) {
      const bulkUpdates = successMatches.map((m) => ({
        aggregateId: m.aggregateId,
        status: "RECONCILED" as const,
        statementId: m.statementId,
      }));
      await this.orchestratorService.bulkUpdateReconciliationStatus(bulkUpdates);
    }
  
    // Auto-generate draft vouchers for all successful matches
    if (successMatches.length > 0) {
      // Group by statement date for bank_date
      const matchesByDate = new Map<string, string[]>();
      for (const m of successMatches) {
        const stmt = statements.find(s => s.id === m.statementId);
        const bankDate = stmt?.transaction_date
          ? (typeof stmt.transaction_date === 'string' ? stmt.transaction_date.slice(0, 10) : new Date(stmt.transaction_date).toISOString().slice(0, 10))
          : new Date().toISOString().slice(0, 10);
        if (!matchesByDate.has(bankDate)) matchesByDate.set(bankDate, []);
        matchesByDate.get(bankDate)!.push(m.aggregateId);
      }
      for (const [bankDate, aggIds] of matchesByDate) {
      }
    }

    // ── Cash Deposit matching for remaining statements ──
    const remainingStatements = statements.filter(
      (s: any) => !successMatches.find((m) => m.statementId === String(s.id))
    );

    let cashDepositMatched = 0;
    if (remainingStatements.length > 0) {
      const startDateStr = bufferStart.toISOString().split("T")[0];
      const endDateStr = bufferEnd.toISOString().split("T")[0];
      const deposits = await cashCountsRepository.getDepositedForMatch(startDateStr, endDateStr);

      for (let i = remainingStatements.length - 1; i >= 0; i--) {
        const stmt = remainingStatements[i];
        const stmtAmount = (stmt.credit_amount || 0) - (stmt.debit_amount || 0);
        if (stmtAmount <= 0) continue;
        const stmtDate = new Date(stmt.transaction_date).getTime();

        const depIdx = deposits.findIndex((dep) => {
          const depDate = new Date(dep.deposited_at || dep.deposit_date).getTime();
          const dayDiff = Math.abs(stmtDate - depDate) / (1000 * 3600 * 24);
          const cashTolerance = Math.max(matchingCriteria.amountTolerance, dep.deposit_amount * 0.005);
          return Math.abs(stmtAmount - dep.deposit_amount) <= cashTolerance && dayDiff <= matchingCriteria.dateBufferDays;
        });

        if (depIdx !== -1) {
          const dep = deposits[depIdx];
          try {
            await this.repository.markAsReconciledCashDeposit(String(stmt.id), dep.id, userId);
            await cashCountsRepository.reconcileDeposit(dep.id, String(stmt.id));
            await this.repository.logAction({
              companyId: companyId || "",
              userId,
              action: "AUTO_MATCH_CASH_DEPOSIT",
              statementId: String(stmt.id),
              details: { cashDepositId: dep.id, depositAmount: dep.deposit_amount },
            });
            cashDepositMatched++;
            deposits.splice(depIdx, 1);
            remainingStatements.splice(i, 1);
          } catch (err: any) {
            logError("Cash deposit confirm match failed", { statementId: stmt.id, depositId: dep.id, error: err.message });
          }
        }
      }
    }

    return {
      matched: successMatches.length + cashDepositMatched,
      matchedAggregates: successMatches.length,
      matchedCashDeposits: cashDepositMatched,
      failed: matches.length - successMatches.length,
      matches: successMatches,
    };
  }



  async getStatements(
    startDate?: Date,
    endDate?: Date,
    bankAccountIds?: number[],
    options?: {
      status?: "RECONCILED" | "UNRECONCILED";
      search?: string;
      isReconciled?: boolean;
      creditOnly?: boolean;
      sortField?: string;
      sortOrder?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<{ data: any[]; pagination: any }> {
    const { data: statements, total } = await this.repository.getByDateRange(
      startDate,
      endDate,
      bankAccountIds,
      options,
    );

    const page =
      options?.offset !== undefined && options?.limit
        ? Math.floor(options.offset / options.limit) + 1
        : 1;

    const processedData = statements.map((s) => {
      const bankAmount = s.credit_amount - s.debit_amount;

      const status: BankReconciliationStatus = s.is_reconciled
        ? BankReconciliationStatus.RECONCILED
        : BankReconciliationStatus.UNRECONCILED;

      return {
        ...s,
        amount: bankAmount,
        status,
        potentialMatches: [],
      };
    });

    const limit = options?.limit || 50;

    return createPaginatedResponse(processedData, total, page, limit);
  }

  async getPotentialMatches(statementId: string): Promise<any[]> {
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

  async getBankAccountsStatus(startDate: Date, endDate: Date): Promise<any[]> {
    return this.repository.getBankAccountsStatus(startDate, endDate);
  }

  async getAllBankAccounts(): Promise<any[]> {
    return this.repository.getAllBankAccounts();
  }

  async getSummary(startDate: Date, endDate: Date): Promise<any> {
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
      uniqueStatementIds.map((id) => this.repository.findById(id)),
    );

    const invalidStatements = statements.filter((s) => !s || s.is_reconciled);
    if (invalidStatements.length > 0) {
      throw new Error("Beberapa statement tidak valid atau sudah dicocokkan");
    }

    const totalBankAmount = statements.reduce((sum, s) => {
      const amount = (s.credit_amount || 0) - (s.debit_amount || 0);
      return sum + amount;
    }, 0);

    const aggregateAmount = aggregate.nett_amount;
    const difference = totalBankAmount - aggregateAmount;
    const differencePercent =
      aggregateAmount !== 0 ? Math.abs(difference) / aggregateAmount : 0;

    const isWithinTolerance =
      differencePercent <= this.multiMatchConfig.defaultTolerancePercent;
    if (!isWithinTolerance && !overrideDifference) {
      throw new Error(
        `Selisih ${(differencePercent * 100).toFixed(2)}% melebihi tolerance ${this.multiMatchConfig.defaultTolerancePercent * 100}%. Gunakan override jika ingin melanjutkan.`,
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

    const statementDetails = statements.map((s) => ({
      statementId: s.id,
      amount: (s.credit_amount || 0) - (s.debit_amount || 0),
    }));
    await this.repository.addStatementsToGroup(groupId, statementDetails);

    await this.repository.markStatementsAsReconciledWithGroup(
      uniqueStatementIds,
      groupId,
      userId,
    );

    await this.feeReconciliationService.calculateAndSaveFeeDiscrepancyMultiMatch(
      aggregateId,
      totalBankAmount,
    );

    await this.orchestratorService.updateReconciliationStatus(
      aggregateId,
      "RECONCILED",
      undefined,
      userId,
    );

    await this.repository.logAction({
      companyId: companyId || "",
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

    // Audit log for CREATE_MULTI_MATCH
    if (userId) {
      await AuditService.log('CREATE', 'bank_reconciliation_multi_match', groupId, userId, 
        null, 
        { aggregateId, statementIds: uniqueStatementIds, totalBankAmount, aggregateAmount, difference }
      )
    }

    // Auto-generate draft voucher for multi-match
    const firstStmt = statements[0];
    const multiMatchBankDate = typeof firstStmt.transaction_date === 'string'
      ? firstStmt.transaction_date.slice(0, 10)
      : new Date(firstStmt.transaction_date).toISOString().slice(0, 10);

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

    await this.repository.undoReconciliationGroup(groupId, userId);

    if (group.aggregate_id) {
      await this.feeReconciliationService.resetFeeDiscrepancy(
        group.aggregate_id,
      )
    }

    if (group.aggregate_id) {
      await this.orchestratorService.updateReconciliationStatus(
        group.aggregate_id,
        "PENDING",
      );
    }

    await this.repository.logAction({
      companyId: companyId || "",
      userId,
      action: "UNDO_MULTI_MATCH",
      aggregateId: group.aggregate_id,
      details: {
        groupId,
        isMultiMatchUndo: true,
      },
    });

    // Audit log for UNDO_MULTI_MATCH
    if (userId) {
      await AuditService.log('DELETE', 'bank_reconciliation_multi_match', groupId, userId, 
        { aggregateId: group.aggregate_id, statementIds: group.statement_ids }, 
        null
      )
    }
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

    const tolerance =
      tolerancePercent ?? this.multiMatchConfig.defaultTolerancePercent;
    const days =
      dateToleranceDays ?? this.multiMatchConfig.defaultDateToleranceDays;
    const max = maxStatements ?? this.multiMatchConfig.defaultMaxStatements;

    const aggregateDate = new Date(aggregate.transaction_date);
    const startDate = new Date(aggregateDate);
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date(aggregateDate);
    endDate.setDate(endDate.getDate() + days);

    const statements =
      await this.repository.getUnreconciledStatementsForSuggestion(
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
    const amounts = statements.map((s) => ({
      ...s,
      amount: (s.credit_amount || 0) - (s.debit_amount || 0),
    }));

    const midGroups = new Map<string, any[]>();
    amounts.forEach((stmt) => {
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

      combos.forEach((combo) => {
        const totalAmount = combo.reduce(
          (sum: number, s: any) => sum + s.amount,
          0,
        );
        suggestions.push({
          statements: combo,
          totalAmount,
          matchPercentage:
            1 - Math.abs(totalAmount - targetAmount) / targetAmount,
          confidence: "HIGH",
          reason: `MID: ${mid}`,
        });
      });
    }

    const nonMidStatements = amounts.filter(
      (s) => !this.extractMID(s.description),
    );
    const fallbackCombos = this.findExactMatchCombinations(
      nonMidStatements,
      targetAmount,
      tolerancePercent,
      maxStatements,
    );

    fallbackCombos.forEach((combo) => {
      const totalAmount = combo.reduce(
        (sum: number, s: any) => sum + s.amount,
        0,
      );
      suggestions.push({
        statements: combo,
        totalAmount,
        matchPercentage:
          1 - Math.abs(totalAmount - targetAmount) / targetAmount,
        confidence: "MEDIUM",
        reason: "Amount match only",
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

    return results
      .sort((a, b) => {
        const sumA = a.reduce((s: number, st: any) => s + st.amount, 0);
        const sumB = b.reduce((s: number, st: any) => s + st.amount, 0);
        return Math.abs(sumA - targetAmount) - Math.abs(sumB - targetAmount);
      })
      .slice(0, 10);
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
  async getUnreconciledStatements(
    bankAccountId?: number,
    search?: string,
    limit: number = 200,
    offset: number = 0,
    startDate?: Date,  // ← tambah
    endDate?: Date,    // ← tambah
  ): Promise<{ data: any[]; total: number }> {
    try {
      // Get today's date as default
      const today = new Date()
      // Default: 3 bulan ke belakang kalau tidak dipass
      const effectiveStart = startDate ?? new Date(today.getFullYear(), today.getMonth() - 3, 1)
      const effectiveEnd   = endDate ?? today

      let statements: any[];

      // Get accurate total count from DB first
      const dbTotal = await this.repository.countUnreconciled(
        effectiveStart,
        effectiveEnd,
        bankAccountId || undefined,
      );

      if (bankAccountId) {
        // When searching, fetch all from DB so in-memory filter is complete
        // When not searching, let DB handle offset/limit
        statements = await this.repository.getUnreconciledBatch(
          effectiveStart,
          effectiveEnd,
          search ? dbTotal || 10000 : limit,
          search ? 0 : offset,
          bankAccountId,
        );
      } else {
        const accounts = await this.repository.getAllBankAccounts();
        const accountStatements = await Promise.all(
          accounts.map(account =>
            this.repository.getUnreconciledBatch(
              effectiveStart,
              effectiveEnd,
              search ? 10000 : limit + offset,
              0,
              account.id,
            )
          )
        )
        statements = accountStatements.flat()
      }

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        statements = statements.filter(
          (s) =>
            s.description?.toLowerCase().includes(searchLower) ||
            s.reference_number?.toLowerCase().includes(searchLower),
        );
      }

      // Total: DB count for non-search, filtered count for search
      const total = search ? statements.length : dbTotal;

      // Apply offset and limit
      // - Single-account without search: DB already applied offset/limit
      // - Otherwise: slice in-memory
      const paginatedStatements = (bankAccountId && !search)
        ? statements
        : statements.slice(offset, offset + limit);

      const data = paginatedStatements.map((s) => {
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

      return { data, total };
    } catch (error: any) {
      logError("Error getting unreconciled statements for reverse matching", {
        bankAccountId,
        search,
        error: error.message,
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
    tolerancePercent: number = 0.05, // 5% default tolerance
    startDate?: Date, 
    endDate?: Date,
  ): Promise<any[]> {
    try {
      // Get today's date as default
      const today = new Date();
      const effectiveStart = startDate?? new Date(today.getFullYear(), today.getMonth()-3, 1); // Start of month
      const effectiveEnd = endDate?? today;

      // Get all unreconciled statements
      const accounts = await this.repository.getAllBankAccounts();
      const accountStatements = await Promise.all(
        accounts.map(account =>
          this.repository.getUnreconciledBatch(
            effectiveStart,
            effectiveEnd,
            10000,
            0,
            account.id,
          )
        )
      )
      const allStatements = accountStatements.flat()

      // Calculate tolerance
      const tolerance = targetAmount * tolerancePercent;
      const minAmount = targetAmount - tolerance;
      const maxAmount = targetAmount + tolerance;

      // Filter statements by amount range
      const matchingStatements = allStatements.filter((s) => {
        const bankAmount = (s.credit_amount || 0) - (s.debit_amount || 0);
        return bankAmount >= minAmount && bankAmount <= maxAmount;
      });

      // Sort by closest match first
      matchingStatements.sort((a, b) => {
        const amountA = Math.abs(
          (a.credit_amount || 0) - (a.debit_amount || 0) - targetAmount,
        );
        const amountB = Math.abs(
          (b.credit_amount || 0) - (b.debit_amount || 0) - targetAmount,
        );
        return amountA - amountB;
      });

      // Limit results
      const limitedResults = matchingStatements.slice(0, 50);

      // Transform to include computed fields
      return limitedResults.map((s) => {
        const bankAmount = (s.credit_amount || 0) - (s.debit_amount || 0);
        const difference = Math.abs(bankAmount - targetAmount);
        const matchPercentage = 1 - difference / targetAmount;

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
        error: error.message,
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
