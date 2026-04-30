import { pool } from "@/config/db";
import { logInfo, logError } from "@/config/logger";

/**
 * Sync pos_sync_aggregates → aggregated_transactions after recalculation.
 *
 * Uses single RPC call `sync_pos_aggregates_batch` which handles:
 * - Bulk upsert POS_SYNC entries into aggregated_transactions
 * - Auto-supersede unreconciled manual CSV entries
 * - Migrate reconciled POS twins → POS_SYNC
 * - Sync VOID aggregates
 */
export async function syncPosSyncToAggregated(
  salesDate: string,
): Promise<{ synced: number; superseded: number; voided: number }> {
  const result = { synced: 0, superseded: 0, voided: 0 };

  try {
    const { rows } = await pool.query(
      `SELECT * FROM sync_pos_aggregates_batch($1::date)`,
      [salesDate]
    );

    const data = rows[0];
    result.synced = data?.synced ?? 0;
    result.superseded = data?.superseded ?? 0;
    result.voided = data?.voided ?? 0;

    logInfo("syncPosSyncToAggregated: done", { salesDate, ...result });
    return result;
  } catch (err: unknown) {
    logError("syncPosSyncToAggregated: failed", { salesDate, error: (err as Error).message });
    return result;
  }
}
