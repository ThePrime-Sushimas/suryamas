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
    private readonly orchestratorService?: any, // Placeholder for OrchestratorService
    private readonly feeReconciliationService?: any // Placeholder for FeeReconciliationService
  ) {}

  /**
   * Reconcile a single POS aggregate with a bank statement
   */
  async reconcile(
    aggregateId: string, 
    statementId: string, 
    notes?: string
  ): Promise<any> {
    const statement = await this.repository.findById(statementId);
    if (!statement) {
      throw new Error('Bank statement not found');
    }

    if (statement.is_reconciled) {
      throw new AlreadyReconciledError(statementId);
    }

    // Verify difference against threshold
    // We'd get aggregate amount here
    // const agg = await this.orchestratorService.getAggregate(aggregateId);
    // const diff = this.calculateDifference(agg.nett_amount, statement.credit_amount - statement.debit_amount);
    // if (diff.absolute > this.config.differenceThreshold) {
    //   throw new DifferenceThresholdExceededError(diff.absolute, this.config.differenceThreshold);
    // }
    
    await this.repository.markAsReconciled(statementId, aggregateId);
    
    // TODO: Log action to bank_reconciliation_logs
    
    return { 
      success: true, 
      matched: true,
      statementId,
      aggregateId,
      notes
    };
  }

  /**
   * Auto-match multiple aggregates with statements using tiered priority logic
   */
  async autoMatch(
    companyId: string, 
    date: Date, 
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
    const aggregates = this.orchestratorService 
      ? await this.orchestratorService.getAggregatesForDate(companyId, date)
      : [];

    const matches: ReconciliationMatch[] = [];
    const remainingStatements = [...statements];
    const remainingAggregates = [...aggregates];

    // Priority 1: Exact Reference Number Match
    this.processMatching(remainingStatements, remainingAggregates, matches, (s, a) => 
      s.reference_number && a.reference_number && s.reference_number === a.reference_number,
      'EXACT_REF', 100
    );

    // Priority 2: Amount + Exact Date
    this.processMatching(remainingStatements, remainingAggregates, matches, (s, a) => {
      const sAmount = s.credit_amount - s.debit_amount;
      const sDate = new Date(s.transaction_date).toDateString();
      const aDate = new Date(a.transaction_date).toDateString();
      return Math.abs(sAmount - a.nett_amount) <= matchingCriteria.amountTolerance && sDate === aDate;
    }, 'EXACT_AMOUNT_DATE', 90);

    // Priority 3: Amount + Date Buffer
    this.processMatching(remainingStatements, remainingAggregates, matches, (s, a) => {
      const sAmount = s.credit_amount - s.debit_amount;
      const sDate = new Date(s.transaction_date).getTime();
      const aDate = new Date(a.transaction_date).getTime();
      const dayDiff = Math.abs(sDate - aDate) / (1000 * 3600 * 24);
      return Math.abs(sAmount - a.nett_amount) <= matchingCriteria.amountTolerance && dayDiff <= matchingCriteria.dateBufferDays;
    }, 'FUZZY_AMOUNT_DATE', 80);

    // 5. Apply matches to Database
    for (const match of matches) {
      await this.repository.markAsReconciled(match.statementId, match.aggregateId);
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
    // Potentially search for fuzzy matches to suggest to user
    return statements.map(s => ({
      id: s.id,
      date: s.transaction_date,
      description: s.description,
      amount: s.credit_amount - s.debit_amount,
      reason: 'UNMATCHED'
    }));
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

