import { BankReconciliationRepository } from './bank-reconciliation.repository';
import { 
  BankReconciliationStatus, 
  MatchingCriteria, 
  ReconciliationMatch 
} from './bank-reconciliation.types';

export class BankReconciliationService {
  private readonly defaultCriteria: MatchingCriteria = {
    amountTolerance: 0.01,
    dateBufferDays: 3,
    differenceThreshold: 100
  };

  constructor(private readonly repository: BankReconciliationRepository) {}

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
      throw new Error('Bank statement is already reconciled');
    }

    // TODO: Verify aggregate existence via Orchestrator or direct DB
    
    await this.repository.markAsReconciled(statementId, aggregateId);
    
    return { 
      success: true, 
      matched: true,
      statementId,
      aggregateId,
      notes
    };
  }

  /**
   * Auto-match multiple aggregates with statements for a specific company and date
   */
  async autoMatch(
    companyId: string, 
    date: Date, 
    criteria?: Partial<MatchingCriteria>
  ): Promise<any> {
    const matchingCriteria = { ...this.defaultCriteria, ...criteria };
    
    // 1. Get unreconciled statements
    const statements = await this.repository.getUnreconciled(companyId, date);
    
    // 2. Get aggregates for the same date
    // Note: We'll need access to the aggregates table, usually via service-orchestrator
    // For now, let's assume we have them or a way to get them.
    // const aggregates = await this.orchestrator.getAggregatesForDate(companyId, date);
    const aggregates: any[] = []; // Placeholder

    const matches: ReconciliationMatch[] = [];
    const unreconciledStatements = [...statements];

    // 3. Algorithm Phase 1: Exact Matches (Amount + Date + Ref if available)
    for (let i = unreconciledStatements.length - 1; i >= 0; i--) {
      const statement = unreconciledStatements[i];
      const amount = statement.credit_amount - statement.debit_amount;
      
      const perfectMatchIdx = aggregates.findIndex(agg => 
        Math.abs(agg.nett_amount - amount) <= matchingCriteria.amountTolerance &&
        (!agg.reference_number || agg.reference_number === statement.reference_number)
      );

      if (perfectMatchIdx !== -1) {
        const agg = aggregates[perfectMatchIdx];
        matches.push({
          aggregateId: agg.id,
          statementId: statement.id,
          matchScore: 100,
          matchCriteria: 'EXACT_AMOUNT_DATE',
          difference: 0
        });
        
        // Remove from both lists
        unreconciledStatements.splice(i, 1);
        aggregates.splice(perfectMatchIdx, 1);
      }
    }

    // 4. Algorithm Phase 2: Fuzzy Matches (Date Buffer)
    // TODO: Implement fuzzy matching using date ranges

    // 5. Apply matches to Database
    for (const match of matches) {
      await this.repository.markAsReconciled(match.statementId, match.aggregateId);
    }

    return { 
      matched: matches.length, 
      unmatched: unreconciledStatements.length,
      matches 
    };
  }

  /**
   * Get reconciliation discrepancies
   */
  async getDiscrepancies(companyId: string, date: Date): Promise<any[]> {
    const statements = await this.repository.getUnreconciled(companyId, date);
    
    return statements.map(s => {
      const amount = s.credit_amount - s.debit_amount;
      return {
        id: s.id,
        date: s.transaction_date,
        description: s.description,
        amount,
        reason: 'UNMATCHED',
        potentialMatches: [] // TODO: Search for potential matches
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

