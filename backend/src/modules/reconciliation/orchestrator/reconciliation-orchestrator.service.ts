import { supabase } from '../../../config/supabase';
import { logInfo, logError, logDebug } from '../../../config/logger';
import { 
  AggregatedTransaction, 
  ReconciliationAggregate,
  IReconciliationOrchestratorService 
} from './reconciliation-orchestrator.types';

export class ReconciliationOrchestratorService implements IReconciliationOrchestratorService {
  /**
   * Get aggregated transactions for a specific company and date
   * with additional data needed for reconciliation
   */
  async getAggregatesForDate(companyId: string, date: Date): Promise<ReconciliationAggregate[]> {
    const dateStr = date.toISOString().split('T')[0];
    logInfo('Fetching aggregated transactions for reconciliation', { 
      companyId, 
      date: dateStr,
      action: 'get_aggregates_for_date' 
    });

    try {
      // Query dengan join ke payment_methods untuk mendapatkan payment method name
      const { data, error } = await supabase
        .from('aggregated_transactions')
        .select(`
          *,
          payment_methods:payment_method_id (
            id,
            name,
            code
          )
        `)
        // Assuming company_id is linked via something or we filter by date and payment methods
        // For now, let's keep the filter simple as per DDL
        .eq('transaction_date', dateStr)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        logError('Database error fetching aggregated transactions', { 
          error: error.message, 
          date: dateStr,
          query: 'aggregated_transactions.select'
        });
        throw new Error(`Failed to fetch aggregated transactions: ${error.message}`);
      }

      if (!data || data.length === 0) {
        logInfo('No aggregated transactions found for date', { date: dateStr });
        return [];
      }

      // Transform data ke format reconciliation
      return data.map(agg => this.transformToReconciliationAggregate(agg));
      
    } catch (error) {
      logError('Failed to get aggregated transactions', {
        date: dateStr,
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Get aggregates within a date range (for reconciliation summary)
   */
  async getAggregatesByDateRange(
    companyId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<ReconciliationAggregate[]> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    logInfo('Fetching aggregated transactions for date range', { 
      companyId, 
      startDate: startDateStr,
      endDate: endDateStr
    });

    try {
      const { data, error } = await supabase
        .from('aggregated_transactions')
        .select(`
          *,
          payment_methods:payment_method_id (
            name,
            code
          )
        `)
        .gte('transaction_date', startDateStr)
        .lte('transaction_date', endDateStr)
        .is('deleted_at', null)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        logError('Error fetching aggregated transactions by date range', { 
          error: error.message, 
          startDate: startDateStr,
          endDate: endDateStr 
        });
        throw new Error(`Failed to fetch aggregated transactions by date range: ${error.message}`);
      }

      return (data || []).map(agg => this.transformToReconciliationAggregate(agg));
      
    } catch (error) {
      logError('Failed to get aggregated transactions by date range', {
        startDate: startDateStr,
        endDate: endDateStr,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get a single aggregate by ID with all details
   */
  async getAggregate(id: string): Promise<AggregatedTransaction> {
    logDebug('Fetching single aggregated transaction', { aggregateId: id });

    try {
      const { data, error } = await supabase
        .from('aggregated_transactions')
        .select(`
          *,
          payment_methods:payment_method_id (
            name,
            code
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Record not found
          logError('Aggregated transaction not found', { aggregateId: id });
          throw new Error(`Aggregated transaction ${id} not found`);
        }
        logError('Database error fetching single aggregated transaction', { 
          aggregateId: id, 
          error: error.message 
        });
        throw new Error(`Failed to fetch aggregate: ${error.message}`);
      }

      return data;
      
    } catch (error) {
      logError('Failed to get single aggregated transaction', {
        aggregateId: id,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update reconciliation status of an aggregate
   * This is called when a match is confirmed
   */
  async updateReconciliationStatus(
    aggregateId: string, 
    status: 'PENDING' | 'RECONCILED' | 'DISCREPANCY',
    statementId?: string,
    reconciledBy?: string
  ): Promise<void> {
    logInfo('Updating aggregated transaction reconnaissance status', { 
      aggregateId, 
      status,
      statementId,
      reconciledBy 
    });

    try {
      const updateData: any = {
        is_reconciled: status === 'RECONCILED',
        // In this schema, 'status' column is 'READY', 'FAILED', etc. 
        // We'll keep 'status' logic if applicable but 'is_reconciled' is the primary flag.
        updated_at: new Date().toISOString()
      };

      // If needed, we could store reconciled metadata in a separate table or 
      // check if aggregated_transactions should have these columns.
      // For now we map to the primary 'is_reconciled' field.

      const { error } = await supabase
        .from('aggregated_transactions')
        .update(updateData)
        .eq('id', aggregateId);

      if (error) {
        logError('Failed to update reconciliation status', { 
          aggregateId, 
          status,
          error: error.message 
        });
        throw new Error(`Failed to update reconciliation status: ${error.message}`);
      }

      logInfo('Successfully updated aggregated transaction reconciliation status', { 
        aggregateId, 
        status 
      });
      
    } catch (error) {
      logError('Error updating reconciliation status', {
        aggregateId,
        status,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get reconciliation summary statistics for a period
   */
  async getReconciliationSummary(
    companyId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<any> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    try {
      // Get summary
      return await this.getSummaryFallback(companyId, startDateStr, endDateStr);
    } catch (error) {
      logError('Error getting reconciliation summary', {
        companyId,
        startDate: startDateStr,
        endDate: endDateStr,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Summary calculation for aggregated_transactions
   */
  private async getSummaryFallback(
    companyId: string, 
    startDate: string, 
    endDate: string
  ): Promise<any> {
    try {
      const { data: aggData, error: aggError } = await supabase
        .from('aggregated_transactions')
        .select('is_reconciled, net_amount')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .is('deleted_at', null);

      if (aggError) throw aggError;

      const { data: stmtData, error: stmtError } = await supabase
        .from('bank_statement_transactions')
        .select('id, is_reconciled, credit_amount, debit_amount')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .is('deleted_at', null);

      if (stmtError) throw stmtError;

      // Calculate aggregated totals
      const totalAggregates = aggData?.length || 0;
      const reconciledAggregates = aggData?.filter(agg => agg.is_reconciled).length || 0;
      const totalStatements = stmtData?.length || 0;
      const reconciledStatements = stmtData?.filter(stmt => stmt.is_reconciled).length || 0;

      // Calculate totals
      const totalNetAmount = aggData?.reduce((sum, agg) => sum + (Number(agg.net_amount) || 0), 0) || 0;
      const totalBankAmount = stmtData?.reduce((sum, stmt) => sum + ((Number(stmt.credit_amount) || 0) - (Number(stmt.debit_amount) || 0)), 0) || 0;

      // Calculate difference
      const totalDifference = Math.abs(totalNetAmount - totalBankAmount);

      // Calculate percentage reconciled (based on statements matched)
      const percentageReconciled = totalStatements > 0 
        ? (reconciledStatements / totalStatements) * 100 
        : 0;

      const summary = {
        period: {
          startDate,
          endDate
        },
        totalAggregates,
        totalStatements,
        autoMatched: 0, // Will be populated by auto-match process
        manuallyMatched: reconciledStatements,
        discrepancies: totalStatements - reconciledStatements,
        unreconciled: totalStatements - reconciledStatements,
        totalDifference,
        percentageReconciled
      };

      return summary;
      
    } catch (error) {
      throw new Error(`Failed to get summary: ${(error as Error).message}`);
    }
  }

  /**
   * Transform database record to reconciliation format
   */
  private transformToReconciliationAggregate(agg: any): ReconciliationAggregate {
    return {
      id: agg.id,
      nett_amount: Number(agg.net_amount),
      transaction_date: agg.transaction_date,
      reference_number: agg.source_ref, // Mapping source_ref to reference_number
      payment_method_id: agg.payment_method_id,
      payment_method_name: agg.payment_methods?.name,
      gross_amount: Number(agg.gross_amount),
      transaction_count: 1, // Individual transaction record
      reconciliation_status: agg.is_reconciled ? 'RECONCILED' : 'PENDING'
    };
  }

  /**
   * Find potential aggregated transactions for a bank statement
   */
  async findPotentialAggregatesForStatement(
    companyId: string,
    statementAmount: number,
    statementDate: Date,
    tolerance: number = 0.01,
    dateBufferDays: number = 3
  ): Promise<ReconciliationAggregate[]> {
    const dateStr = statementDate.toISOString().split('T')[0];
    const minDate = new Date(statementDate);
    minDate.setDate(minDate.getDate() - dateBufferDays);
    const maxDate = new Date(statementDate);
    maxDate.setDate(maxDate.getDate() + dateBufferDays);

    const minDateStr = minDate.toISOString().split('T')[0];
    const maxDateStr = maxDate.toISOString().split('T')[0];

    logDebug('Finding potential aggregated transactions for statement', {
      statementAmount,
      statementDate: dateStr,
      tolerance,
      dateBufferDays
    });

    try {
      // First, try exact match with tolerance
      const { data, error } = await supabase
        .from('aggregated_transactions')
        .select(`
          *,
          payment_methods:payment_method_id (name)
        `)
        .gte('transaction_date', minDateStr)
        .lte('transaction_date', maxDateStr)
        .is('deleted_at', null)
        .eq('is_reconciled', false) // Only unmatched
        .or(`net_amount.gte.${statementAmount - tolerance},net_amount.lte.${statementAmount + tolerance}`)
        .order('transaction_date', { ascending: false })
        .limit(10);

      if (error) {
        logError('Error finding potential aggregated transactions', { 
          error: error.message,
          statementAmount 
        });
        throw error;
      }

      // Calculate confidence score for each potential match
      const potentialMatches = (data || []).map(agg => {
        const nettAmount = Number(agg.net_amount);
        const amountDiff = Math.abs(nettAmount - statementAmount);
        const dateDiff = Math.abs(
          new Date(agg.transaction_date).getTime() - statementDate.getTime()
        ) / (1000 * 3600 * 24);

        // Calculate confidence score (0-100)
        let score = 100;
        score -= (amountDiff / (statementAmount || 1)) * 100 * 10;
        score -= dateDiff * 5;
        score = Math.max(0, Math.min(100, Math.round(score)));

        const transformed = this.transformToReconciliationAggregate(agg);
        return {
          ...transformed,
          confidence_score: score,
          amount_difference: amountDiff,
          date_difference_days: dateDiff
        };
      });

      return potentialMatches.sort((a, b) => b.confidence_score - a.confidence_score);
      
    } catch (error) {
      logError('Failed to find potential matches', {
        statementAmount,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Batch update reconciliation status
   */
  async bulkUpdateReconciliationStatus(
    updates: Array<{
      aggregateId: string;
      status: 'PENDING' | 'RECONCILED' | 'DISCREPANCY';
      statementId?: string;
    }>
  ): Promise<void> {
    if (updates.length === 0) return;

    logInfo('Bulk updating aggregated transactions status', { 
      count: updates.length
    });

    try {
      const updatePromises = updates.map(update => {
        return supabase
          .from('aggregated_transactions')
          .update({
            is_reconciled: update.status === 'RECONCILED',
            updated_at: new Date().toISOString()
          })
          .eq('id', update.aggregateId);
      });

      const results = await Promise.allSettled(updatePromises);

      const errors = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} records`);
      }
      
    } catch (error) {
      logError('Failed bulk update', {
        error: (error as Error).message
      });
      throw error;
    }
  }
}

export const reconciliationOrchestratorService = new ReconciliationOrchestratorService();
