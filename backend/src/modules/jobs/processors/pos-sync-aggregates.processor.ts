import { supabase } from "@/config/supabase";
import { logInfo, logError, logWarn } from "@/config/logger";

const BATCH_SIZE = 100;

// ─── Result & Types ───────────────────────────────────────────────────────────

export interface PosSyncAggregateResult {
  created: number;
  updated: number;
  skipped: number;
  invalid: number;
  pending: number;
  failed: number;
  errors: Array<{ key: string; error: string }>;
}

interface StagingBranchRow {
  pos_id: number;
  branch_name: string;
  mapped_id: string | null;
}

interface StagingPaymentRow {
  pos_id: number;
  name: string;
  mapped_id: number | null;
}

interface PaymentMethodFeeRow {
  id: number;
  fee_percentage: number;
  fee_fixed_amount: number;
  fee_fixed_per_transaction: boolean;
}

interface RawSaleRow {
  sales_num: string;
  sales_date: string;
  branch_id: number;
  subtotal: number;
  discount_total: number;
  other_tax_total: number;
  vat_total: number;
  grand_total: number;
}

interface RawPaymentRow {
  sales_num: string;
  payment_method_id: number;
  payment_amount: number;
}

interface AggregateGroup {
  sales_date: string;
  branch_pos_id: number;
  payment_pos_id: number;
  lines: Array<{
    sales_num: string;
    subtotal: number;
    discount_total: number;
    other_tax_total: number;
    vat_total: number;
    grand_total: number;
    payment_amount: number;
  }>;
}

interface PendingUpdate {
  id: string;
  key: string;
  recalculated_count: number;
  data: Record<string, any>;
}

// ─── Main Processor ───────────────────────────────────────────────────────────

export async function processPosSyncAggregates(
  salesNums?: string[],
): Promise<PosSyncAggregateResult> {
  const startTime = Date.now();
  const result: PosSyncAggregateResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    pending: 0,
    invalid: 0,
    failed: 0,
    errors: [],
  };

  try {
    // ── PHASE 1: Load raw data ──────────────────────────────────────────
    logInfo("PosSyncAggregates: loading raw data", {
      filter: salesNums ? `${salesNums.length} sales_nums` : "all",
    });

    let salesQuery = supabase
      .from("tr_saleshead")
      .select(
        "sales_num, sales_date, branch_id, subtotal, discount_total, other_tax_total, vat_total, grand_total",
      );

    if (salesNums && salesNums.length > 0) {
      salesQuery = salesQuery.in("sales_num", salesNums);
    }

    const { data: salesRows, error: salesErr } = await salesQuery;
    if (salesErr) throw salesErr;
    if (!salesRows || salesRows.length === 0) {
      logInfo("PosSyncAggregates: no sales data found");
      return result;
    }

    const allSalesNums = salesRows.map((r) => r.sales_num);

    const { data: paymentRows, error: payErr } = await supabase
      .from("tr_salespayment")
      .select("sales_num, payment_method_id, payment_amount")
      .in("sales_num", allSalesNums);

    if (payErr) throw payErr;

    // ── PHASE 2: Load lookup tables ────────────────────────────────────
    const [
      { data: stagingBranches, error: sbErr },
      { data: stagingPayments, error: spErr },
    ] = await Promise.all([
      supabase
        .from("pos_staging_branches")
        .select("pos_id, branch_name, mapped_id"),
      supabase
        .from("pos_staging_payment_methods")
        .select("pos_id, name, mapped_id"),
    ]);

    if (sbErr) throw sbErr;
    if (spErr) throw spErr;

    const branchMap = new Map<number, StagingBranchRow>();
    for (const b of stagingBranches ?? []) branchMap.set(b.pos_id, b);

    const paymentStagingMap = new Map<number, StagingPaymentRow>();
    for (const p of stagingPayments ?? []) paymentStagingMap.set(p.pos_id, p);

    // Load fee config untuk semua internal payment_method_id yang ter-mapped
    const mappedPaymentIds = [...paymentStagingMap.values()]
      .map((p) => p.mapped_id)
      .filter((id): id is number => id !== null);

    const feeMap = new Map<number, PaymentMethodFeeRow>();
    if (mappedPaymentIds.length > 0) {
      const { data: pmFeeRows, error: feeErr } = await supabase
        .from("payment_methods")
        .select(
          "id, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction",
        )
        .in("id", mappedPaymentIds);

      if (feeErr) throw feeErr;
      for (const pm of pmFeeRows ?? []) feeMap.set(pm.id, pm);
    }

    // ── PHASE 3: Index payments by sales_num ───────────────────────────
    const paymentIndex = new Map<string, RawPaymentRow[]>();
    for (const p of paymentRows ?? []) {
      if (!paymentIndex.has(p.sales_num)) paymentIndex.set(p.sales_num, []);
      paymentIndex.get(p.sales_num)!.push(p as RawPaymentRow);
    }

    // ── PHASE 4: Group by sales_date + branch_pos_id + payment_pos_id ──
    const groups = new Map<string, AggregateGroup>();

    for (const sale of salesRows as RawSaleRow[]) {
      const payments = paymentIndex.get(sale.sales_num) ?? [];

      for (const pay of payments) {
        const key = `${sale.sales_date}|${sale.branch_id}|${pay.payment_method_id}`;

        if (!groups.has(key)) {
          groups.set(key, {
            sales_date: sale.sales_date,
            branch_pos_id: sale.branch_id,
            payment_pos_id: pay.payment_method_id,
            lines: [],
          });
        }

        groups.get(key)!.lines.push({
          sales_num: sale.sales_num,
          subtotal: Number(sale.subtotal ?? 0),
          discount_total: Number(sale.discount_total ?? 0),
          other_tax_total: Number(sale.other_tax_total ?? 0),
          vat_total: Number(sale.vat_total ?? 0),
          grand_total: Number(sale.grand_total ?? 0),
          payment_amount: Number(pay.payment_amount ?? 0),
        });
      }
    }

    logInfo("PosSyncAggregates: groups built", { total: groups.size });

    // ── PHASE 5: Check existing aggregates ────────────────────────────
    const allDates = [
      ...new Set([...groups.values()].map((g) => g.sales_date)),
    ];

    const { data: existingRows } = await supabase
      .from("pos_sync_aggregates")
      .select(
        "id, status, recalculated_count, sales_date, branch_pos_id, payment_pos_id, grand_total, transaction_count, payment_method_id",
      )
      .in("sales_date", allDates);

    const existingMap = new Map<
      string,
      {
        id: string;
        status: string;
        recalculated_count: number;
        grand_total: number;
        transaction_count: number;
        payment_method_id: number | null;
      }
    >();
    for (const row of existingRows ?? []) {
      const key = `${row.sales_date}|${row.branch_pos_id}|${row.payment_pos_id}`;
      existingMap.set(key, {
        id: row.id,
        status: row.status,
        recalculated_count: row.recalculated_count ?? 0,
        grand_total: Number(row.grand_total),
        transaction_count: row.transaction_count,
        payment_method_id: row.payment_method_id,
      });
    }

    // ── PHASE 6: Prepare upsert data ──────────────────────────────────
    const toInsert: any[] = [];
    const toUpdate: PendingUpdate[] = [];
    const linesByKey = new Map<string, any[]>();
    const now = new Date().toISOString();

    for (const [key, group] of groups) {
      try {
        const { sales_date, branch_pos_id, payment_pos_id, lines } = group;

        // Resolve branch
        const stagingBranch = branchMap.get(branch_pos_id);
        const branch_id = stagingBranch?.mapped_id ?? null;
        const branch_name = stagingBranch?.branch_name ?? null;

        // Resolve payment method
        const stagingPm = paymentStagingMap.get(payment_pos_id);
        const payment_method_id = stagingPm?.mapped_id ?? null;

        // Status
        const mappingIncomplete = !branch_id || !payment_method_id;
        let status = mappingIncomplete ? "PENDING_MAPPING" : "READY";
        let skip_reason = mappingIncomplete
          ? [
              !branch_id
                ? `branch pos_id ${branch_pos_id} belum di-mapping`
                : null,
              !payment_method_id
                ? `payment pos_id ${payment_pos_id} belum di-mapping`
                : null,
            ]
              .filter(Boolean)
              .join("; ")
          : null;

        // Sum amounts
        const gross_amount = lines.reduce((s, l) => s + l.subtotal, 0);
        const discount_amount = lines.reduce((s, l) => s + l.discount_total, 0);
        const tax_amount = lines.reduce((s, l) => s + l.vat_total, 0);
        const other_tax_amount = lines.reduce(
          (s, l) => s + l.other_tax_total,
          0,
        );
        const grand_total = lines.reduce((s, l) => s + l.grand_total, 0);
        const payment_amount = lines.reduce((s, l) => s + l.payment_amount, 0);

        const uniqueSales = new Set(lines.map((l) => l.sales_num));
        const transaction_count = uniqueSales.size;

        const diff = Math.abs(grand_total - payment_amount);
        if (diff > 1) {
          logWarn("PosSyncAggregates: imbalance detected", {
            key,
            grand_total,
            payment_amount,
            diff,
          });
          status = "INVALID";
          skip_reason = skip_reason
            ? `${skip_reason}; imbalance detected (diff: ${diff})`
            : `imbalance detected (diff: ${diff})`;
        }

        // Fee calculation
        let fee_percentage = 0;
        let fee_fixed_amount = 0;
        let percentage_fee_amount = 0;
        let fixed_fee_amount_calc = 0;
        let total_fee_amount = 0;
        let nett_amount = grand_total;

        if (payment_method_id) {
          const fee = feeMap.get(payment_method_id);
          if (fee) {
            fee_percentage = fee.fee_percentage ?? 0;
            fee_fixed_amount = fee.fee_fixed_amount ?? 0;
            percentage_fee_amount = grand_total * (fee_percentage / 100);
            fixed_fee_amount_calc = fee.fee_fixed_per_transaction
              ? transaction_count * fee_fixed_amount
              : fee_fixed_amount;
            total_fee_amount = percentage_fee_amount + fixed_fee_amount_calc;
            nett_amount = grand_total - total_fee_amount;
          }
        }

        const aggregateData = {
          sales_date,
          branch_pos_id,
          branch_id,
          branch_name,
          payment_pos_id,
          payment_method_id,
          gross_amount,
          discount_amount,
          tax_amount,
          other_tax_amount,
          grand_total,
          payment_amount,
          transaction_count,
          fee_percentage,
          fee_fixed_amount,
          percentage_fee_amount,
          fixed_fee_amount_calc,
          total_fee_amount,
          nett_amount,
          status,
          skip_reason,
          synced_at: now,
          updated_at: now,
        };

        // Prepare lines
        const preparedLines = lines.map((l) => ({
          sales_num: l.sales_num,
          sales_date,
          branch_pos_id,
          payment_pos_id,
          subtotal: l.subtotal,
          discount_total: l.discount_total,
          other_tax_total: l.other_tax_total,
          vat_total: l.vat_total,
          grand_total: l.grand_total,
          payment_amount: l.payment_amount,
          created_at: now,
        }));
        linesByKey.set(key, preparedLines);

        const existing = existingMap.get(key);

        if (!existing) {
          toInsert.push({ ...aggregateData, created_at: now });
        } else if (existing.status === "JOURNALED") {
          result.skipped++;
          logWarn("PosSyncAggregates: skip JOURNALED", { key });
        } else {
          const amountChanged =
            Math.abs(existing.grand_total - grand_total) > 0.01;
          const countChanged = existing.transaction_count !== transaction_count;
          const methodChanged =
            existing.payment_method_id !== payment_method_id;
          const dataChanged = amountChanged || countChanged || methodChanged;

          if (!dataChanged) {
            result.skipped++;
            continue;
          }

          const isStatusRecalculated = status === "READY";
          const finalStatus = isStatusRecalculated ? "RECALCULATED" : status;

          toUpdate.push({
            id: existing.id,
            key,
            recalculated_count: existing.recalculated_count,
            data: {
              ...aggregateData,
              status: finalStatus,
              recalculated: true,
              recalculated_at: now,
              recalculated_count: existing.recalculated_count + 1,
            },
          });
        }

        if (status === "PENDING_MAPPING") result.pending++;
        if (status === "INVALID") result.invalid++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          key,
          error: err instanceof Error ? err.message : "Unknown",
        });
        logError("PosSyncAggregates: error preparing group", { key, err });
      }
    }

    // ── PHASE 7: Bulk insert ───────────────────────────────────────────
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);

      const { data: inserted, error } = await supabase
        .from("pos_sync_aggregates")
        .upsert(batch, {
          onConflict: "sales_date,branch_pos_id,payment_pos_id",
        })
        .select("id, sales_date, branch_pos_id, payment_pos_id");

      if (error) {
        logError("PosSyncAggregates: insert error", { error });
        result.failed += batch.length;
        continue;
      }

      result.created += inserted?.length ?? 0;

      // Insert lines
      const linesBatch: any[] = [];
      for (const row of inserted ?? []) {
        const key = `${row.sales_date}|${row.branch_pos_id}|${row.payment_pos_id}`;
        for (const line of linesByKey.get(key) ?? []) {
          linesBatch.push({ ...line, aggregate_id: row.id });
        }
      }

      if (linesBatch.length > 0) {
        const { error: lineErr } = await supabase
          .from("pos_sync_aggregate_lines")
          .upsert(linesBatch, {
            onConflict: "aggregate_id,sales_num,payment_pos_id",
          });

        if (lineErr)
          logError("PosSyncAggregates: lines insert error", { lineErr });
      }
    }

    // ── PHASE 8: Update existing (recalculate) ────────────────────────
    for (const item of toUpdate) {
      const { error } = await supabase
        .from("pos_sync_aggregates")
        .update(item.data)
        .eq("id", item.id);

      if (error) {
        logError("PosSyncAggregates: update error", { id: item.id, error });
        result.failed++;
        continue;
      }

      result.updated++;
      logWarn("PosSyncAggregates: aggregate recalculated", {
        id: item.id,
        recalculated_count: item.recalculated_count + 1,
        key: item.key,
      });

      // ← GANTI: delete dulu, baru insert fresh
      const lines = linesByKey.get(item.key) ?? [];
      if (lines.length > 0) {
        // Hapus hanya lines yang tidak ada di data baru
        const newSalesNums = lines.map((l) => l.sales_num);
        const { data: existingLines, error: fetchErr } = await supabase
          .from("pos_sync_aggregate_lines")
          .select("sales_num")
          .eq("aggregate_id", item.id);
        if (fetchErr) {
          logError("PosSyncAggregates: lines fetch error", { fetchErr });
          continue;
        }
        const toDelete = (existingLines ?? [])
          .map((l) => l.sales_num)
          .filter((sn) => !newSalesNums.includes(sn));
        if (toDelete.length > 0) {
          const { error: deleteErr } = await supabase
            .from("pos_sync_aggregate_lines")
            .delete()
            .eq("aggregate_id", item.id)
            .in("sales_num", toDelete);
          if (deleteErr) {
            logError("PosSyncAggregates: lines delete error", { deleteErr });
            continue;
          }
        }

        // Upsert lines baru/berubah
        const { error: lineErr } = await supabase
          .from("pos_sync_aggregate_lines")
          .upsert(
            lines.map((l) => ({ ...l, aggregate_id: item.id })),
            { onConflict: "aggregate_id,sales_num,payment_pos_id" },
          );

        if (lineErr)
          logError("PosSyncAggregates: lines insert error", { lineErr });
      }
    }

    logInfo("PosSyncAggregates: complete", {
      ...result,
      duration_ms: Date.now() - startTime,
    });

    return result;
  } catch (err) {
    logError("PosSyncAggregates: fatal error", { err });
    throw err;
  }
}
