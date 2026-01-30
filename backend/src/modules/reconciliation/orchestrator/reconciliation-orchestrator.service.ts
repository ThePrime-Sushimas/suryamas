import { supabase } from '../../../config/supabase';
import { logInfo, logError } from '../../../config/logger';

export class ReconciliationOrchestratorService {
  /**
   * Get aggregated POS transactions for a specific company and date
   * This is used by the bank reconciliation service to match against bank statements
   */
  async getAggregatesForDate(companyId: string, date: Date): Promise<any[]> {
    const dateStr = date.toISOString().split('T')[0];
    logInfo('Fetching POS aggregates for reconciliation', { companyId, date: dateStr });

    try {
      const { data, error } = await supabase
        .from('pos_aggregates')
        .select('*')
        .eq('company_id', companyId)
        .eq('transaction_date', dateStr)
        .is('deleted_at', null);

      if (error) {
        logError('Error fetching POS aggregates', { error: error.message, companyId, date: dateStr });
        throw new Error(error.message);
      }

      // Map to the format expected by BankReconciliationService
      return (data || []).map(agg => ({
        id: agg.id,
        nett_amount: agg.total_gross_amount - (agg.total_fee_amount || 0),
        transaction_date: agg.transaction_date,
        reference_number: agg.reference_number,
        payment_method_id: agg.payment_method_id
      }));
    } catch (error) {
      logError('Failed to get POS aggregates', {
        companyId,
        date: dateStr,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get a single aggregate by ID
   */
  async getAggregate(id: string): Promise<any> {
    const { data, error } = await supabase
      .from('pos_aggregates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }
}
