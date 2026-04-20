import { posSyncAggregatesRepository } from "./pos-sync-aggregates.repository";
import { logInfo, logError, logWarn } from "@/config/logger";

/**
 * Sync pos_sync_aggregates → aggregated_transactions after recalculation.
 * - Upserts POS_SYNC entries into aggregated_transactions
 * - Auto-supersedes unreconciled manual CSV entries for same (date, branch, payment_method)
 */
export async function syncPosSyncToAggregated(
  salesDate: string,
): Promise<{ synced: number; superseded: number }> {
  const result = { synced: 0, superseded: 0 };

  let syncAggs: any[];
  try {
    syncAggs = await posSyncAggregatesRepository.getReadyBySalesDate(salesDate);
  } catch (err: any) {
    logError("syncPosSyncToAggregated: fetch failed", { salesDate, error: err.message });
    return result;
  }

  if (!syncAggs.length) return result;

  for (const p of syncAggs) {
    const sourceRef = `${p.sales_date}_${p.branch_pos_id}_${p.payment_pos_id}`;

    try {
      const upserted = await posSyncAggregatesRepository.upsertToAggregatedTransactions({
        source_type: "POS_SYNC",
        source_id: p.id,
        source_ref: sourceRef,
        transaction_date: p.sales_date,
        payment_method_id: p.payment_method_id,
        branch_id: p.branch_id,
        branch_name: p.branch_name,
        gross_amount: p.gross_amount,
        discount_amount: p.discount_amount,
        tax_amount: p.tax_amount,
        nett_amount: p.nett_amount,
        total_fee_amount: p.total_fee_amount,
        percentage_fee_amount: p.percentage_fee_amount,
        fixed_fee_amount: p.fixed_fee_amount_calc,
        bill_after_discount: p.grand_total,
        pos_sync_aggregate_id: p.id,
        status: "READY",
      });

      result.synced++;

      // Supersede unreconciled manual CSV for same (date, branch, payment_method)
      if ((p.branch_id || p.branch_name) && p.payment_method_id) {
        try {
          const superseded = await posSyncAggregatesRepository.supersedeManualEntries({
            supersededById: upserted.id,
            transactionDate: p.sales_date,
            paymentMethodId: p.payment_method_id,
            branchId: p.branch_id,
            branchName: p.branch_name,
          });
          result.superseded += superseded.length;
        } catch (supErr: any) {
          logWarn("syncPosSyncToAggregated: supersede failed", {
            sourceRef,
            error: supErr.message,
          });
        }

        // Migrate reconciled POS twin → POS_SYNC (if POS was reconciled before POS_SYNC arrived)
        try {
          const reconciledTwin = await posSyncAggregatesRepository.findReconciledPosTwin({
            transactionDate: p.sales_date,
            paymentMethodId: p.payment_method_id,
            branchId: p.branch_id,
            branchName: p.branch_name,
          });
          if (reconciledTwin) {
            const migrated = await posSyncAggregatesRepository.migrateReconciledPosToSync(
              reconciledTwin.id,
              upserted.id,
            );
            if (migrated) {
              result.superseded++;
              logInfo("syncPosSyncToAggregated: migrated reconciled POS → POS_SYNC", {
                posId: reconciledTwin.id,
                syncId: upserted.id,
                sourceRef,
              });
            } else {
              logWarn("syncPosSyncToAggregated: migrate returned false (guard hit?)", {
                posId: reconciledTwin.id,
                syncId: upserted.id,
                sourceRef,
              });
            }
          }
        } catch (migErr: any) {
          logWarn("syncPosSyncToAggregated: migrate reconciled failed", {
            sourceRef,
            error: migErr.message,
          });
        }
      }
    } catch (err: any) {
      logError("syncPosSyncToAggregated: upsert failed", {
        sourceRef,
        error: err.message,
      });
    }
  }

  logInfo("syncPosSyncToAggregated: done", { salesDate, ...result });
  return result;
}
