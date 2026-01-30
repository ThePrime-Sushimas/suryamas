import { BankReconciliationRepository } from './bank-reconciliation.repository';
import { 
  BankReconciliationStatus, 
  MatchingCriteria, 
  ReconciliationMatch 
} from './bank-reconciliation.types';
import { 
  AlreadyReconciledError, 
  NoMatchFoundError, 
  DifferenceThresholdExceededError 
} from './bank-reconciliation.errors';
import { getReconciliationConfig } from './bank-reconciliation.config';

export class BankReconciliationService {
  private readonly config = getReconciliationConfig();

  constructor(
    private readonly repository: BankReconciliationRepository,
    private readonly orchestratorService: any,
    private readonly feeReconciliationService: any
  ) {}

  /**
   * Reconcile a single POS aggregate with a bank statement
   */
  async reconcile(
    aggregateId: string, 
    statementId: string, 
    userId?: string,
    notes?: string
  ): Promise<any> {
    const statement = await this.repository.findById(statementId);
    if (!statement) {
      throw new Error('Bank statement not found');
    }

    if (statement.is_reconciled) {
      throw new AlreadyReconciledError(statementId);
    }

    // 1. Mark as reconciled in DB
    await this.repository.markAsReconciled(statementId, aggregateId);
    
    // 2. Audit Trail
    await this.repository.logAction({
      companyId: statement.company_id,
      userId,
      action: 'MANUAL_RECONCILE',
      statementId,
      aggregateId,
      details: { notes }
    });
    
    return { 
      success: true, 
      matched: true,
      statementId,
      aggregateId,
      notes
    };
  }

  /**
   * Undo reconciliation for a statement
   */
  async undo(statementId: string, userId?: string): Promise<void> {
    const statement = await this.repository.findById(statementId);
    if (!statement) {
      throw new Error('Bank statement not found');
    }

    await this.repository.undoReconciliation(statementId);

    // Audit Trail
    await this.repository.logAction({
      companyId: statement.company_id,
      userId,
      action: 'UNDO',
      statementId,
      details: { previousAggregateId: statement.aggregate_id }
    });
  }

  /**
   * Auto-match multiple aggregates with statements using tiered priority logic
   */
  async autoMatch(
    companyId: string, 
    date: Date, 
    userId?: string,
    criteria?: Partial<MatchingCriteria>
  ): Promise<any> {
    const matchingCriteria = { 
      amountTolerance: this.config.amountTolerance,
      dateBufferDays: this.config.dateBufferDays,
      ...criteria 
    };
    
    // 1. Get unreconciled statements (possibly in batches)
    const statements = await this.repository.getUnreconciledBatch(
      companyId, 
      date, 
      this.config.autoMatchBatchSize
    );
    
    // 2. Get aggregates (expected net) from orchestrator
    const aggregates = await this.orchestratorService.getAggregatesForDate(companyId, date);

    const matches: ReconciliationMatch[] = [];
    const remainingStatements = [...statements];
    const remainingAggregates = [...aggregates];

    // Priority 1: Exact Reference Number Match
    this.processMatching(remainingStatements, remainingAggregates, matches, (s: any, a: any) => 
      s.reference_number && a.reference_number && s.reference_number === a.reference_number,
      'EXACT_REF', 100
    );

    // Priority 2: Amount + Exact Date
    this.processMatching(remainingStatements, remainingAggregates, matches, (s: any, a: any) => {
      const sAmount = s.credit_amount - s.debit_amount;
      const sDate = new Date(s.transaction_date).toDateString();
      const aDate = new Date(a.transaction_date).toDateString();
      return Math.abs(sAmount - a.nett_amount) <= matchingCriteria.amountTolerance && sDate === aDate;
    }, 'EXACT_AMOUNT_DATE', 90);

    // Priority 3: Amount + Date Buffer
    this.processMatching(remainingStatements, remainingAggregates, matches, (s: any, a: any) => {
      const sAmount = s.credit_amount - s.debit_amount;
      const sDate = new Date(s.transaction_date).getTime();
      const aDate = new Date(a.transaction_date).getTime();
      const dayDiff = Math.abs(sDate - aDate) / (1000 * 3600 * 24);
      return Math.abs(sAmount - a.nett_amount) <= matchingCriteria.amountTolerance && dayDiff <= matchingCriteria.dateBufferDays;
    }, 'FUZZY_AMOUNT_DATE', 80);

    // 5. Apply matches and log them
    for (const match of matches) {
      await this.repository.markAsReconciled(match.statementId, match.aggregateId);
      await this.repository.logAction({
        companyId,
        userId,
        action: 'AUTO_MATCH',
        statementId: match.statementId,
        aggregateId: match.aggregateId,
        details: { matchScore: match.matchScore, matchCriteria: match.matchCriteria }
      });
    }

    return { 
      matched: matches.length, 
      unmatched: remainingStatements.length,
      matches 
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
    criteriaName: ReconciliationMatch['matchCriteria'],
    score: number
  ) {
    for (let i = statements.length - 1; i >= 0; i--) {
      const statement = statements[i];
      const matchIdx = aggregates.findIndex(agg => predicate(statement, agg));

      if (matchIdx !== -1) {
        const agg = aggregates[matchIdx];
        matches.push({
          aggregateId: agg.id,
          statementId: statement.id,
          matchScore: score,
          matchCriteria: criteriaName,
          difference: Math.abs((statement.credit_amount - statement.debit_amount) - agg.nett_amount)
        });
        
        statements.splice(i, 1);
        aggregates.splice(matchIdx, 1);
      }
    }
  }

  /**
   * Get reconciliation discrepancies
   */
  async getDiscrepancies(companyId: string, date: Date): Promise<any[]> {
    const statements = await this.repository.getUnreconciled(companyId, date);
    const aggregates = await this.orchestratorService.getAggregatesForDate(companyId, date);

    return statements.map(s => {
      const sAmount = s.credit_amount - s.debit_amount;
      
      // Look for potential matches for this discrepancy
      const potentialMatches = aggregates
        .map((a: any) => ({
          ...a,
          diff: this.calculateDifference(a.nett_amount, sAmount)
        }))
        .filter((a: { diff: { percentage: number } }) => a.diff.percentage <= 10) // Suggest if within 10%
        .sort((a: { diff: { absolute: number } }, b: { diff: { absolute: number } }) => a.diff.absolute - b.diff.absolute)
        .slice(0, 3);

      return {
        id: s.id,
        date: s.transaction_date,
        description: s.description,
        amount: sAmount,
        reason: 'UNMATCHED',
        potentialMatches
      };
    });
  }

  /**
   * Calculate difference between POS and bank
   */
  calculateDifference(aggregateAmount: number, statementAmount: number): { absolute: number; percentage: number } {
    const absolute = Math.abs(aggregateAmount - statementAmount);
    const percentage = aggregateAmount !== 0 ? (absolute / aggregateAmount) * 100 : 0;
    
    return { absolute, percentage };
  }
}

