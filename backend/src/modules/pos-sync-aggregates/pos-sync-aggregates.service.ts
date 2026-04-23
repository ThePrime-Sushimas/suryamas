import { posSyncAggregatesRepository } from "./pos-sync-aggregates.repository";
import { logInfo, logError, logWarn } from "@/config/logger";

/**
 * Sync pos_sync_aggregates → aggregated_transactions after recalculation.
 * - Upserts POS_SYNC entries into aggregated_transactions
 * - Auto-supersedes unreconciled manual CSV entries for same (date, branch, payment_method)
 */
export async function syncPosSyncToAggregated(
  salesDate: string,
): Promise<{ synced: number; superseded: number; voided: number }> {
  const result = { synced: 0, superseded: 0, voided: 0 };

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
        rounding_amount: p.rounding_amount ?? 0,
        delivery_cost: p.delivery_cost ?? 0,
        order_fee: p.order_fee ?? 0,
        voucher_discount_amount: p.voucher_discount_amount ?? 0,
        promotion_discount_amount: p.promotion_discount_amount ?? 0,
        menu_discount_amount: p.menu_discount_amount ?? 0,
        voucher_payment_amount: p.voucher_payment_amount ?? 0,
        other_vat_amount: p.other_vat_amount ?? 0,
        service_charge_amount: p.other_tax_amount ?? 0,
        pax_total: p.pax_total ?? 0,
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

  // ── Sync VOID aggregates ──────────────────────────────────────────────
  let voidAggs: any[];
  try {
    voidAggs = await posSyncAggregatesRepository.getVoidBySalesDate(salesDate);
  } catch (err: any) {
    logError("syncPosSyncToAggregated: fetch VOID failed", { salesDate, error: err.message });
    return result;
  }

  for (const v of voidAggs) {
    const sourceRef = `${v.sales_date}_${v.branch_pos_id}_VOID`;

    try {
      await posSyncAggregatesRepository.upsertToAggregatedTransactions({
        source_type: "POS_SYNC",
        source_id: v.id,
        source_ref: sourceRef,
        transaction_date: v.sales_date,
        payment_method_id: null,
        branch_id: v.branch_id,
        branch_name: v.branch_name,
        gross_amount: v.gross_amount ?? 0,
        discount_amount: v.discount_amount ?? 0,
        tax_amount: v.tax_amount ?? 0,
        nett_amount: 0,
        total_fee_amount: 0,
        percentage_fee_amount: 0,
        fixed_fee_amount: 0,
        bill_after_discount: v.grand_total ?? 0,
        rounding_amount: v.rounding_amount ?? 0,
        delivery_cost: v.delivery_cost ?? 0,
        order_fee: v.order_fee ?? 0,
        voucher_discount_amount: v.voucher_discount_amount ?? 0,
        promotion_discount_amount: v.promotion_discount_amount ?? 0,
        menu_discount_amount: v.menu_discount_amount ?? 0,
        voucher_payment_amount: v.voucher_payment_amount ?? 0,
        other_vat_amount: v.other_vat_amount ?? 0,
        service_charge_amount: v.other_tax_amount ?? 0,
        pax_total: v.pax_total ?? 0,
        pos_sync_aggregate_id: v.id,
        status: "VOID",
      });

      result.voided++;
    } catch (err: any) {
      logError("syncPosSyncToAggregated: VOID upsert failed", {
        sourceRef,
        error: err.message,
      });
    }
  }

  if (voidAggs.length > 0) {
    logInfo("syncPosSyncToAggregated: VOID sync done", {
      salesDate,
      voided: result.voided,
    });
  }

  return result;
}
