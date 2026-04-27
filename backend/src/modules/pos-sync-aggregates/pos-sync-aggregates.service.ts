import { supabase } from "@/config/supabase";
import { logInfo, logError } from "@/config/logger";

/**
 * Sync pos_sync_aggregates → aggregated_transactions after recalculation.
 *
 * Uses single RPC call `sync_pos_aggregates_batch` which handles:
 * - Bulk upsert POS_SYNC entries into aggregated_transactions
 * - Auto-supersede unreconciled manual CSV entries
 * - Migrate reconciled POS twins → POS_SYNC
 * - Sync VOID aggregates
 *
 * Before: N×4 API calls per sales_date (upsert + supersede + findTwin + migrate per record)
 * After:  1 RPC call per sales_date
 */
export async function syncPosSyncToAggregated(
  salesDate: string,
): Promise<{ synced: number; superseded: number; voided: number }> {
  const result = { synced: 0, superseded: 0, voided: 0 };

  try {
    const { data, error } = await supabase.rpc('sync_pos_aggregates_batch', {
      p_sales_date: salesDate,
    });

    if (error) throw error;

    result.synced = data?.synced ?? 0;
    result.superseded = data?.superseded ?? 0;
    result.voided = data?.voided ?? 0;

    logInfo("syncPosSyncToAggregated: done", { salesDate, ...result });
    return result;
  } catch (err: any) {
    logError("syncPosSyncToAggregated: failed", { salesDate, error: err.message });
    return result;
  }
}
