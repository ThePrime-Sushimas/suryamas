import { pool } from "@/config/db";
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
  status_id: number;
  subtotal: number;
  discount_total: number;
  menu_discount_total: number;
  promotion_discount: number;
  voucher_discount_total: number;
  other_tax_total: number;
  vat_total: number;
  other_vat_total: number;
  grand_total: number;
  rounding_total: number;
  delivery_cost: number;
  order_fee: number;
  voucher_total: number;
  pax_total: number;
}

interface VoidAggregateGroup {
  sales_date: string;
  branch_pos_id: number;
  void_count: number;
  void_sales_nums: string[];
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  other_tax_amount: number;
  grand_total: number;
  rounding_amount: number;
  delivery_cost: number;
  order_fee: number;
  voucher_discount_amount: number;
  promotion_discount_amount: number;
  menu_discount_amount: number;
  voucher_payment_amount: number;
  other_vat_amount: number;
  pax_total: number;
}

const VOID_STATUS_ID = 12;

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
    menu_discount_total: number;
    promotion_discount: number;
    voucher_discount_total: number;
    other_tax_total: number;
    vat_total: number;
    other_vat_total: number;
    grand_total: number;
    rounding_total: number;
    delivery_cost: number;
    order_fee: number;
    voucher_total: number;
    payment_amount: number;
    pax_total: number;
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

    let salesRows: RawSaleRow[];
    if (salesNums && salesNums.length > 0) {
      const { rows } = await pool.query(
        `SELECT sales_num, sales_date, branch_id, status_id, subtotal, discount_total, menu_discount_total, promotion_discount, voucher_discount_total, other_tax_total, vat_total, other_vat_total, grand_total, rounding_total, delivery_cost, order_fee, voucher_total, pax_total
         FROM tr_saleshead WHERE sales_num = ANY($1::text[])`,
        [salesNums]
      );
      salesRows = rows;
    } else {
      const { rows } = await pool.query(
        `SELECT sales_num, sales_date, branch_id, status_id, subtotal, discount_total, menu_discount_total, promotion_discount, voucher_discount_total, other_tax_total, vat_total, other_vat_total, grand_total, rounding_total, delivery_cost, order_fee, voucher_total, pax_total
         FROM tr_saleshead`
      );
      salesRows = rows;
    }

    if (salesRows.length === 0) {
      logInfo("PosSyncAggregates: no sales data found");
      return result;
    }

    const allSalesNums = salesRows.map((r) => r.sales_num);

    const { rows: paymentRows } = await pool.query(
      `SELECT sales_num, payment_method_id, payment_amount FROM tr_salespayment WHERE sales_num = ANY($1::text[])`,
      [allSalesNums]
    );

    // ── PHASE 2: Load lookup tables ────────────────────────────────────
    const [
      { rows: stagingBranches },
      { rows: stagingPayments },
    ] = await Promise.all([
      pool.query(`SELECT pos_id, branch_name, mapped_id FROM pos_staging_branches`),
      pool.query(`SELECT pos_id, name, mapped_id FROM pos_staging_payment_methods`),
    ]);

    const branchMap = new Map<number, StagingBranchRow>();
    for (const b of stagingBranches) branchMap.set(b.pos_id, b);

    const paymentStagingMap = new Map<number, StagingPaymentRow>();
    for (const p of stagingPayments) paymentStagingMap.set(p.pos_id, p);

    // Load fee config untuk semua internal payment_method_id yang ter-mapped
    const mappedPaymentIds = [...paymentStagingMap.values()]
      .map((p) => p.mapped_id)
      .filter((id): id is number => id !== null);

    const feeMap = new Map<number, PaymentMethodFeeRow>();
    if (mappedPaymentIds.length > 0) {
      const { rows: pmFeeRows } = await pool.query(
        `SELECT id, fee_percentage, fee_fixed_amount, fee_fixed_per_transaction
         FROM payment_methods WHERE id = ANY($1::int[])`,
        [mappedPaymentIds]
      );
      for (const pm of pmFeeRows) feeMap.set(pm.id, pm);
    }

    // ── PHASE 3: Index payments by sales_num ───────────────────────────
    const paymentIndex = new Map<string, RawPaymentRow[]>();
    for (const p of paymentRows) {
      if (!paymentIndex.has(p.sales_num)) paymentIndex.set(p.sales_num, []);
      paymentIndex.get(p.sales_num)!.push(p as RawPaymentRow);
    }

    // ── PHASE 4: Group by sales_date + branch_pos_id + payment_pos_id ──
    const groups = new Map<string, AggregateGroup>();
    const voidGroups = new Map<string, VoidAggregateGroup>();

    for (const sale of salesRows as RawSaleRow[]) {
      if (sale.status_id === VOID_STATUS_ID) {
        const voidKey = `${sale.sales_date}|${sale.branch_id}|VOID`;
        if (!voidGroups.has(voidKey)) {
          voidGroups.set(voidKey, {
            sales_date: sale.sales_date,
            branch_pos_id: sale.branch_id,
            void_count: 0,
            void_sales_nums: [],
            gross_amount: 0,
            discount_amount: 0,
            tax_amount: 0,
            other_tax_amount: 0,
            grand_total: 0,
            rounding_amount: 0,
            delivery_cost: 0,
            order_fee: 0,
            voucher_discount_amount: 0,
            promotion_discount_amount: 0,
            menu_discount_amount: 0,
            voucher_payment_amount: 0,
            other_vat_amount: 0,
            pax_total: 0,
          });
        }
        const voidGroup = voidGroups.get(voidKey)!;
        voidGroup.void_count++;
        voidGroup.void_sales_nums.push(sale.sales_num);
        voidGroup.gross_amount += Number(sale.subtotal ?? 0);
        voidGroup.discount_amount += Number(sale.discount_total ?? 0);
        voidGroup.tax_amount += Number(sale.vat_total ?? 0);
        voidGroup.other_tax_amount += Number(sale.other_tax_total ?? 0);
        voidGroup.grand_total += Number(sale.grand_total ?? 0);
        voidGroup.rounding_amount += Number(sale.rounding_total ?? 0);
        voidGroup.delivery_cost += Number(sale.delivery_cost ?? 0);
        voidGroup.order_fee += Number(sale.order_fee ?? 0);
        voidGroup.voucher_discount_amount += Number(sale.voucher_discount_total ?? 0);
        voidGroup.promotion_discount_amount += Number(sale.promotion_discount ?? 0);
        voidGroup.menu_discount_amount += Number(sale.menu_discount_total ?? 0);
        voidGroup.voucher_payment_amount += Number(sale.voucher_total ?? 0);
        voidGroup.other_vat_amount += Number(sale.other_vat_total ?? 0);
        voidGroup.pax_total += Number(sale.pax_total ?? 0);
        logWarn("PosSyncAggregates: VOID transaction detected", {
          sales_num: sale.sales_num,
          sales_date: sale.sales_date,
          branch_id: sale.branch_id,
        });
        continue;
      }

      const rawPayments = paymentIndex.get(sale.sales_num) ?? [];

      // Urutkan payment: pastikan CASH ada di akhir supaya bisa menyerap "kembalian"
      const payments = [...rawPayments].sort((a, b) => {
        const nameA = paymentStagingMap.get(a.payment_method_id)?.name?.toLowerCase() || '';
        const nameB = paymentStagingMap.get(b.payment_method_id)?.name?.toLowerCase() || '';
        const isCashA = nameA.includes('cash');
        const isCashB = nameB.includes('cash');
        return isCashA === isCashB ? 0 : isCashA ? 1 : -1;
      });

      let remainingGrandTotal = Number(sale.grand_total ?? 0);
      const saleSubtotal = Number(sale.subtotal ?? 0);
      const saleVat = Number(sale.vat_total ?? 0);
      const saleDiscount = Number(sale.discount_total ?? 0);
      const saleOtherTax = Number(sale.other_tax_total ?? 0);
      const saleGrandTotal = Number(sale.grand_total ?? 0);
      const saleMenuDiscount = Number(sale.menu_discount_total ?? 0);
      const salePromotionDiscount = Number(sale.promotion_discount ?? 0);
      const saleVoucherDiscount = Number(sale.voucher_discount_total ?? 0);
      const saleOtherVat = Number(sale.other_vat_total ?? 0);
      const saleRounding = Number(sale.rounding_total ?? 0);
      const saleDeliveryCost = Number(sale.delivery_cost ?? 0);
      const saleOrderFee = Number(sale.order_fee ?? 0);
      const saleVoucherTotal = Number(sale.voucher_total ?? 0);
      const salePaxTotal = Number(sale.pax_total ?? 0);

      for (let i = 0; i < payments.length; i++) {
        const pay = payments[i];
        const isLast = i === payments.length - 1;

        // FCFS allocation: kalau terakhir, sedot sisa tagihan. Kalau bukan, ambil sesuai payment (maks sisa tagihan)
        const allocated = isLast ? remainingGrandTotal : Math.min(Number(pay.payment_amount ?? 0), remainingGrandTotal);
        remainingGrandTotal -= allocated;

        const ratio = saleGrandTotal > 0 ? allocated / saleGrandTotal : 0;

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
          subtotal: Math.round(saleSubtotal * ratio),
          discount_total: Math.round(saleDiscount * ratio),
          menu_discount_total: Math.round(saleMenuDiscount * ratio),
          promotion_discount: Math.round(salePromotionDiscount * ratio),
          voucher_discount_total: Math.round(saleVoucherDiscount * ratio),
          other_tax_total: Math.round(saleOtherTax * ratio),
          vat_total: Math.round(saleVat * ratio),
          other_vat_total: Math.round(saleOtherVat * ratio),
          grand_total: allocated,
          rounding_total: Math.round(saleRounding * ratio),
          delivery_cost: Math.round(saleDeliveryCost * ratio),
          order_fee: Math.round(saleOrderFee * ratio),
          voucher_total: Math.round(saleVoucherTotal * ratio),
          payment_amount: allocated,
          pax_total: salePaxTotal, // not ratio-split, full per line
        });
      }
    }

    logInfo("PosSyncAggregates: groups built", {
      total: groups.size,
      void_groups: voidGroups.size,
    });

    // ── PHASE 5: Check existing aggregates ────────────────────────────
    const allDates = [
      ...new Set([
        ...[...groups.values()].map((g) => g.sales_date),
        ...[...voidGroups.values()].map((g) => g.sales_date),
      ]),
    ];

    const { rows: existingRows } = await pool.query(
      `SELECT id, status, recalculated_count, sales_date, branch_pos_id, payment_pos_id, grand_total, transaction_count, payment_method_id, total_fee_amount
       FROM pos_sync_aggregates WHERE sales_date = ANY($1::text[])`,
      [allDates]
    );

    const existingMap = new Map<
      string,
      {
        id: string;
        status: string;
        recalculated_count: number;
        grand_total: number;
        transaction_count: number;
        payment_method_id: number | null;
        total_fee_amount: number;
      }
    >();
    for (const row of existingRows) {
      const key = `${row.sales_date}|${row.branch_pos_id}|${row.payment_pos_id}`;
      existingMap.set(key, {
        id: row.id,
        status: row.status,
        recalculated_count: row.recalculated_count ?? 0,
        grand_total: Number(row.grand_total),
        transaction_count: row.transaction_count,
        payment_method_id: row.payment_method_id,
        total_fee_amount: Number(row.total_fee_amount ?? 0),
      });
    }

    // ── PHASE 6: Prepare upsert data ──────────────────────────────────
    const toInsert: any[] = [];
    const toUpdate: PendingUpdate[] = [];
    const linesByKey = new Map<string, any[]>();
    const now = new Date().toISOString();

    // ── Process VOID groups ───────────────────────────────────────────
    for (const [, voidGroup] of voidGroups) {
      const { sales_date, branch_pos_id, void_count, void_sales_nums } = voidGroup;
      const stagingBranch = branchMap.get(branch_pos_id);
      const branch_id = stagingBranch?.mapped_id ?? null;
      const branch_name = stagingBranch?.branch_name ?? null;

      const aggregateData = {
        sales_date,
        branch_pos_id,
        branch_id,
        branch_name,
        payment_pos_id: 0,
        payment_method_id: null,
        gross_amount: voidGroup.gross_amount,
        discount_amount: voidGroup.discount_amount,
        menu_discount_amount: voidGroup.menu_discount_amount,
        promotion_discount_amount: voidGroup.promotion_discount_amount,
        voucher_discount_amount: voidGroup.voucher_discount_amount,
        tax_amount: voidGroup.tax_amount,
        other_tax_amount: voidGroup.other_tax_amount,
        other_vat_amount: voidGroup.other_vat_amount,
        grand_total: voidGroup.grand_total,
        rounding_amount: voidGroup.rounding_amount,
        delivery_cost: voidGroup.delivery_cost,
        order_fee: voidGroup.order_fee,
        voucher_payment_amount: voidGroup.voucher_payment_amount,
        payment_amount: 0,
        transaction_count: 0,
        void_transaction_count: void_count,
        pax_total: voidGroup.pax_total,
        fee_percentage: 0,
        fee_fixed_amount: 0,
        percentage_fee_amount: 0,
        fixed_fee_amount_calc: 0,
        total_fee_amount: 0,
        nett_amount: 0,
        status: "VOID",
        skip_reason: `${void_count} voided transaction(s): ${void_sales_nums.join(", ")}`,
        synced_at: now,
        updated_at: now,
      };

      const existing = existingMap.get(`${sales_date}|${branch_pos_id}|0`);

      if (!existing) {
        toInsert.push({ ...aggregateData, created_at: now });
      } else if (existing.status === "JOURNALED") {
        result.skipped++;
        logWarn("PosSyncAggregates: skip JOURNALED VOID", {
          key: `${sales_date}|${branch_pos_id}|VOID`,
        });
      } else {
        toUpdate.push({
          id: existing.id,
          key: `${sales_date}|${branch_pos_id}|VOID`,
          recalculated_count: existing.recalculated_count,
          data: {
            ...aggregateData,
            status: "VOID",
            recalculated: true,
            recalculated_at: now,
            recalculated_count: existing.recalculated_count + 1,
          },
        });
      }
    }

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
        const isCash = stagingPm?.name?.toLowerCase().includes("cash") || false;

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
        const menu_discount_amount = lines.reduce((s, l) => s + l.menu_discount_total, 0);
        const promotion_discount_amount = lines.reduce((s, l) => s + l.promotion_discount, 0);
        const voucher_discount_amount = lines.reduce((s, l) => s + l.voucher_discount_total, 0);
        const tax_amount = lines.reduce((s, l) => s + l.vat_total, 0);
        const other_tax_amount = lines.reduce((s, l) => s + l.other_tax_total, 0);
        const other_vat_amount = lines.reduce((s, l) => s + l.other_vat_total, 0);
        const grand_total = lines.reduce((s, l) => s + l.grand_total, 0);
        const rounding_amount = lines.reduce((s, l) => s + l.rounding_total, 0);
        const delivery_cost = lines.reduce((s, l) => s + l.delivery_cost, 0);
        const order_fee = lines.reduce((s, l) => s + l.order_fee, 0);
        const voucher_payment_amount = lines.reduce((s, l) => s + l.voucher_total, 0);
        const payment_amount = lines.reduce((s, l) => s + l.payment_amount, 0);
        // pax_total: count unique sales_nums then sum pax per unique sale
        const paxBySale = new Map<string, number>();
        for (const l of lines) paxBySale.set(l.sales_num, l.pax_total);
        const pax_total = [...paxBySale.values()].reduce((s, p) => s + p, 0);

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
          menu_discount_amount,
          promotion_discount_amount,
          voucher_discount_amount,
          tax_amount,
          other_tax_amount,
          other_vat_amount,
          grand_total,
          rounding_amount,
          delivery_cost,
          order_fee,
          voucher_payment_amount,
          payment_amount,
          transaction_count,
          void_transaction_count: 0,
          pax_total,
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
          menu_discount_total: l.menu_discount_total,
          promotion_discount: l.promotion_discount,
          voucher_discount_total: l.voucher_discount_total,
          other_tax_total: l.other_tax_total,
          vat_total: l.vat_total,
          other_vat_total: l.other_vat_total,
          grand_total: l.grand_total,
          rounding_total: l.rounding_total,
          delivery_cost: l.delivery_cost,
          order_fee: l.order_fee,
          voucher_total: l.voucher_total,
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
          const feeChanged =
            Math.abs(existing.total_fee_amount - total_fee_amount) > 0.01;
          const dataChanged = amountChanged || countChanged || methodChanged || feeChanged;

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

    // Explicit column list for aggregate INSERT — consistent across void and normal groups
    const AGG_INSERT_COLS = [
      'sales_date', 'branch_pos_id', 'branch_id', 'branch_name', 'payment_pos_id',
      'payment_method_id', 'gross_amount', 'discount_amount', 'menu_discount_amount',
      'promotion_discount_amount', 'voucher_discount_amount', 'tax_amount', 'other_tax_amount',
      'other_vat_amount', 'grand_total', 'rounding_amount', 'delivery_cost', 'order_fee',
      'voucher_payment_amount', 'payment_amount', 'transaction_count', 'void_transaction_count',
      'pax_total', 'fee_percentage', 'fee_fixed_amount', 'percentage_fee_amount',
      'fixed_fee_amount_calc', 'total_fee_amount', 'nett_amount', 'status', 'skip_reason',
      'synced_at', 'updated_at', 'created_at',
    ] as const;

    const AGG_CONFLICT_COLS = new Set(['sales_date', 'branch_pos_id', 'payment_pos_id', 'created_at']);

    // ── PHASE 7: Bulk insert ───────────────────────────────────────────
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);

      const valueRows: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;
      for (const row of batch) {
        const placeholders: string[] = [];
        for (const col of AGG_INSERT_COLS) {
          placeholders.push(`$${pIdx++}`);
          params.push(row[col] ?? null);
        }
        valueRows.push(`(${placeholders.join(', ')})`);
      }

      const setClauses = AGG_INSERT_COLS.filter(c => !AGG_CONFLICT_COLS.has(c))
        .map(c => `${c} = EXCLUDED.${c}`).join(', ');

      let inserted: Array<{ id: string; sales_date: string; branch_pos_id: number; payment_pos_id: number }> = [];
      try {
        const { rows } = await pool.query(
          `INSERT INTO pos_sync_aggregates (${AGG_INSERT_COLS.join(', ')})
           VALUES ${valueRows.join(', ')}
           ON CONFLICT (sales_date, branch_pos_id, payment_pos_id) DO UPDATE SET ${setClauses}
           RETURNING id, sales_date, branch_pos_id, payment_pos_id`,
          params
        );
        inserted = rows;
      } catch (error) {
        logError("PosSyncAggregates: insert error", { error });
        result.failed += batch.length;
        continue;
      }

      result.created += inserted.length;

      // Insert lines
      const linesBatch: any[] = [];
      for (const row of inserted) {
        const key = `${row.sales_date}|${row.branch_pos_id}|${row.payment_pos_id}`;
        for (const line of linesByKey.get(key) ?? []) {
          linesBatch.push({ ...line, aggregate_id: row.id });
        }
      }

      if (linesBatch.length > 0) {
        const aggregateIds = [...new Set(linesBatch.map((l) => l.aggregate_id))];
        await pool.query(
          `DELETE FROM pos_sync_aggregate_lines WHERE aggregate_id = ANY($1::uuid[])`,
          [aggregateIds]
        );

        // Bulk insert lines with explicit column order
        const LINE_COLS = [
          'aggregate_id', 'sales_num', 'sales_date', 'branch_pos_id', 'payment_pos_id',
          'subtotal', 'discount_total', 'menu_discount_total', 'promotion_discount',
          'voucher_discount_total', 'other_tax_total', 'vat_total', 'other_vat_total',
          'grand_total', 'rounding_total', 'delivery_cost', 'order_fee',
          'voucher_total', 'payment_amount', 'created_at',
        ];
        const lineValueRows: string[] = [];
        const lineParams: unknown[] = [];
        let lIdx = 1;
        for (const line of linesBatch) {
          const ph: string[] = [];
          for (const col of LINE_COLS) { ph.push(`$${lIdx++}`); lineParams.push(line[col] ?? null); }
          lineValueRows.push(`(${ph.join(', ')})`);
        }

        try {
          await pool.query(
            `INSERT INTO pos_sync_aggregate_lines (${LINE_COLS.join(', ')}) VALUES ${lineValueRows.join(', ')}`,
            lineParams
          );
        } catch (lineErr) {
          logError("PosSyncAggregates: lines insert error", { lineErr });
        }
      }
    }

    // ── PHASE 8: Update existing (recalculate) ────────────────────────
    // Explicit column list for updates to avoid Object.keys() ordering issues
    const UPDATE_COLS = [
      'sales_date', 'branch_pos_id', 'branch_id', 'branch_name', 'payment_pos_id',
      'payment_method_id', 'gross_amount', 'discount_amount', 'menu_discount_amount',
      'promotion_discount_amount', 'voucher_discount_amount', 'tax_amount', 'other_tax_amount',
      'other_vat_amount', 'grand_total', 'rounding_amount', 'delivery_cost', 'order_fee',
      'voucher_payment_amount', 'payment_amount', 'transaction_count', 'void_transaction_count',
      'pax_total', 'fee_percentage', 'fee_fixed_amount', 'percentage_fee_amount',
      'fixed_fee_amount_calc', 'total_fee_amount', 'nett_amount', 'status', 'skip_reason',
      'synced_at', 'updated_at', 'recalculated', 'recalculated_at', 'recalculated_count',
    ] as const;

    const LINE_INSERT_COLS = [
      'aggregate_id', 'sales_num', 'sales_date', 'branch_pos_id', 'payment_pos_id',
      'subtotal', 'discount_total', 'menu_discount_total', 'promotion_discount',
      'voucher_discount_total', 'other_tax_total', 'vat_total', 'other_vat_total',
      'grand_total', 'rounding_total', 'delivery_cost', 'order_fee',
      'voucher_total', 'payment_amount', 'created_at',
    ] as const;

    for (const item of toUpdate) {
      const activeCols = UPDATE_COLS.filter(c => item.data[c] !== undefined);
      const sets = activeCols.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const values: unknown[] = activeCols.map(c => item.data[c] ?? null);
      values.push(item.id);

      const { rowCount } = await pool.query(
        `UPDATE pos_sync_aggregates SET ${sets} WHERE id = $${activeCols.length + 1}`,
        values
      );

      if ((rowCount ?? 0) === 0) {
        logWarn("PosSyncAggregates: update no rows affected (may have been deleted)", { id: item.id });
        result.skipped++;
        continue;
      }

      result.updated++;
      logWarn("PosSyncAggregates: aggregate recalculated", {
        id: item.id,
        recalculated_count: item.recalculated_count + 1,
        key: item.key,
      });

      const lines = linesByKey.get(item.key) ?? [];
      if (lines.length > 0) {
        await pool.query(
          `DELETE FROM pos_sync_aggregate_lines WHERE aggregate_id = $1`,
          [item.id]
        );

        const lineValueRows: string[] = [];
        const lineParams: unknown[] = [];
        let lIdx = 1;
        for (const line of lines) {
          const ph: string[] = [];
          for (const col of LINE_INSERT_COLS) {
            ph.push(`$${lIdx++}`);
            lineParams.push(col === 'aggregate_id' ? item.id : (line[col] ?? null));
          }
          lineValueRows.push(`(${ph.join(', ')})`);
        }

        try {
          await pool.query(
            `INSERT INTO pos_sync_aggregate_lines (${LINE_INSERT_COLS.join(', ')}) VALUES ${lineValueRows.join(', ')}`,
            lineParams
          );
        } catch (lineErr) {
          logError("PosSyncAggregates: lines insert error", { lineErr });
        }
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
