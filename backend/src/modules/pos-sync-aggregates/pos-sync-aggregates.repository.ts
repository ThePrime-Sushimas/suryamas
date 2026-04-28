import { pool } from "@/config/db";
import { logError } from "@/config/logger";
import { ListAggregatesParams } from "./pos-sync-aggregates.types";

function escapeSearch(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&')
}

export const posSyncAggregatesRepository = {
  async list(params: ListAggregatesParams = {}) {
    const {
      date_from, date_to, branch_id, branch_ids,
      payment_method_id, payment_method_ids,
      status, is_reconciled, search,
      page = 1, limit = 50, fields,
    } = params;

    const selectFields = fields === 'slim'
      ? `psa.id, psa.sales_date, psa.branch_id, psa.branch_name, psa.status, psa.grand_total, psa.nett_amount, psa.total_fee_amount, psa.transaction_count, psa.void_transaction_count, psa.skip_reason, psa.is_reconciled, psa.payment_method_id, pm.id AS pm_id, pm.name AS pm_name, pm.payment_type AS pm_payment_type`
      : `psa.*, pm.id AS pm_id, pm.name AS pm_name, pm.payment_type AS pm_payment_type`;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (date_from) { conditions.push(`psa.sales_date >= $${idx++}`); values.push(date_from) }
    if (date_to) { conditions.push(`psa.sales_date <= $${idx++}`); values.push(date_to) }
    if (branch_id) { conditions.push(`psa.branch_id = $${idx++}`); values.push(branch_id) }
    if (branch_ids) {
      const ids = branch_ids.split(",").filter(Boolean);
      if (ids.length > 0) { conditions.push(`psa.branch_id = ANY($${idx++}::uuid[])`); values.push(ids) }
    }
    if (payment_method_id) { conditions.push(`psa.payment_method_id = $${idx++}`); values.push(Number(payment_method_id)) }
    if (payment_method_ids) {
      const ids = payment_method_ids.split(",").map(Number).filter(n => !isNaN(n));
      if (ids.length > 0) { conditions.push(`psa.payment_method_id = ANY($${idx++}::int[])`); values.push(ids) }
    }
    if (status) { conditions.push(`psa.status = $${idx++}`); values.push(status) }
    if (is_reconciled !== undefined && is_reconciled !== "") {
      const boolVal = is_reconciled === "true" || is_reconciled === true;
      conditions.push(`psa.is_reconciled = $${idx++}`); values.push(boolVal)
    }
    if (search) {
      const escaped = escapeSearch(search);
      conditions.push(`(psa.branch_name ILIKE $${idx} OR psa.id::text = $${idx + 1})`);
      values.push(`%${escaped}%`, search); idx += 2
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const fromClause = `FROM pos_sync_aggregates psa LEFT JOIN payment_methods pm ON pm.id = psa.payment_method_id`;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ${selectFields} ${fromClause} ${where}
         ORDER BY psa.sales_date DESC, psa.branch_name ASC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${fromClause} ${where}`, values),
    ]);

    const data = dataRes.rows.map(r => ({
      ...r,
      payment_methods: r.pm_id ? { id: r.pm_id, name: r.pm_name, payment_type: r.pm_payment_type } : null,
    }));
    // Clean up pm_ fields
    for (const d of data) { delete d.pm_id; delete d.pm_name; delete d.pm_payment_type }

    return { data, total: countRes.rows[0]?.total ?? 0, page, limit };
  },

  async getById(id: string) {
    const { rows } = await pool.query(
      `SELECT psa.*, pm.id AS pm_id, pm.name AS pm_name, pm.payment_type AS pm_payment_type
       FROM pos_sync_aggregates psa
       LEFT JOIN payment_methods pm ON pm.id = psa.payment_method_id
       WHERE psa.id = $1`,
      [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    r.payment_methods = r.pm_id ? { id: r.pm_id, name: r.pm_name, payment_type: r.pm_payment_type } : null;
    delete r.pm_id; delete r.pm_name; delete r.pm_payment_type;
    return r;
  },

  async getLines(aggregateId: string) {
    const { rows } = await pool.query(
      `SELECT * FROM pos_sync_aggregate_lines WHERE aggregate_id = $1 ORDER BY sales_num ASC`,
      [aggregateId]
    );
    return rows;
  },

  async getSummaryByDate(dateFrom: string, dateTo: string) {
    const { rows } = await pool.query(
      `SELECT sales_date, branch_name, status, grand_total, nett_amount, total_fee_amount, transaction_count
       FROM pos_sync_aggregates WHERE sales_date >= $1 AND sales_date <= $2
       ORDER BY sales_date DESC`,
      [dateFrom, dateTo]
    );
    return rows;
  },

  async getReadyBySalesDate(salesDate: string) {
    const { rows } = await pool.query(
      `SELECT * FROM pos_sync_aggregates WHERE sales_date = $1::date AND status IN ('READY', 'RECALCULATED')`,
      [salesDate]
    );
    return rows;
  },

  async getVoidBySalesDate(salesDate: string) {
    const { rows } = await pool.query(
      `SELECT * FROM pos_sync_aggregates WHERE sales_date = $1::date AND status = 'VOID'`,
      [salesDate]
    );
    return rows;
  },

  async upsertToAggregatedTransactions(row: {
    source_type: string; source_id: string; source_ref: string;
    transaction_date: string; payment_method_id: number | null;
    branch_id: string | null; branch_name: string | null;
    gross_amount: number; discount_amount: number; tax_amount: number;
    nett_amount: number; total_fee_amount: number; percentage_fee_amount: number;
    fixed_fee_amount: number; bill_after_discount: number; rounding_amount: number;
    delivery_cost: number; order_fee: number; voucher_discount_amount: number;
    promotion_discount_amount: number; menu_discount_amount: number;
    voucher_payment_amount: number; other_vat_amount: number;
    service_charge_amount: number; pax_total: number;
    pos_sync_aggregate_id: string; status: string;
  }) {
    const { rows } = await pool.query(
      `INSERT INTO aggregated_transactions
       (source_type, source_id, source_ref, transaction_date, payment_method_id,
        branch_id, branch_name, gross_amount, discount_amount, tax_amount,
        nett_amount, total_fee_amount, percentage_fee_amount, fixed_fee_amount,
        bill_after_discount, rounding_amount, delivery_cost, order_fee,
        voucher_discount_amount, promotion_discount_amount, menu_discount_amount,
        voucher_payment_amount, other_vat_amount, service_charge_amount, pax_total,
        pos_sync_aggregate_id, status, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,NOW())
       ON CONFLICT (source_type, source_id, source_ref) DO UPDATE SET
         transaction_date = EXCLUDED.transaction_date, payment_method_id = EXCLUDED.payment_method_id,
         branch_id = EXCLUDED.branch_id, branch_name = EXCLUDED.branch_name,
         gross_amount = EXCLUDED.gross_amount, discount_amount = EXCLUDED.discount_amount,
         tax_amount = EXCLUDED.tax_amount, nett_amount = EXCLUDED.nett_amount,
         total_fee_amount = EXCLUDED.total_fee_amount, percentage_fee_amount = EXCLUDED.percentage_fee_amount,
         fixed_fee_amount = EXCLUDED.fixed_fee_amount, bill_after_discount = EXCLUDED.bill_after_discount,
         rounding_amount = EXCLUDED.rounding_amount, delivery_cost = EXCLUDED.delivery_cost,
         order_fee = EXCLUDED.order_fee, voucher_discount_amount = EXCLUDED.voucher_discount_amount,
         promotion_discount_amount = EXCLUDED.promotion_discount_amount, menu_discount_amount = EXCLUDED.menu_discount_amount,
         voucher_payment_amount = EXCLUDED.voucher_payment_amount, other_vat_amount = EXCLUDED.other_vat_amount,
         service_charge_amount = EXCLUDED.service_charge_amount, pax_total = EXCLUDED.pax_total,
         pos_sync_aggregate_id = EXCLUDED.pos_sync_aggregate_id, status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING id`,
      [row.source_type, row.source_id, row.source_ref, row.transaction_date, row.payment_method_id,
       row.branch_id, row.branch_name, row.gross_amount, row.discount_amount, row.tax_amount,
       row.nett_amount, row.total_fee_amount, row.percentage_fee_amount, row.fixed_fee_amount,
       row.bill_after_discount, row.rounding_amount, row.delivery_cost, row.order_fee,
       row.voucher_discount_amount, row.promotion_discount_amount, row.menu_discount_amount,
       row.voucher_payment_amount, row.other_vat_amount, row.service_charge_amount, row.pax_total,
       row.pos_sync_aggregate_id, row.status]
    );
    return rows[0];
  },

  /** @deprecated — replaced by sync_pos_aggregates_batch RPC */
  async supersedeManualEntries(params: {
    supersededById: string; transactionDate: string;
    paymentMethodId: number; branchId: string | null; branchName?: string | null;
  }) {
    const { rows } = await pool.query(
      `SELECT * FROM supersede_manual_entries($1, $2, $3, $4, $5)`,
      [params.supersededById, params.transactionDate, params.paymentMethodId, params.branchId ?? null, params.branchName ?? null]
    );
    return rows;
  },

  /** @deprecated — replaced by sync_pos_aggregates_batch RPC */
  async migrateReconciledPosToSync(posId: string, syncId: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT migrate_reconciled_pos_to_sync($1, $2) AS result`,
      [posId, syncId]
    );
    return rows[0]?.result ?? false;
  },

  async supersedeManualIfPosSyncExists(manualIds: string[]): Promise<number> {
    if (manualIds.length === 0) return 0;
    const { rows } = await pool.query(
      `SELECT supersede_manual_if_sync_exists_batch($1::uuid[]) AS result`,
      [manualIds]
    );
    return rows[0]?.result ?? 0;
  },

  /** @deprecated — replaced by sync_pos_aggregates_batch RPC */
  async findReconciledPosTwin(params: {
    transactionDate: string; paymentMethodId: number;
    branchId: string | null; branchName: string | null;
  }): Promise<{ id: string } | null> {
    if (!params.branchName && !params.branchId) return null;

    const conditions = [
      "source_type = 'POS'",
      'transaction_date = $1::date',
      'payment_method_id = $2',
      'is_reconciled = true',
      "status = 'READY'",
      'superseded_by IS NULL',
      'deleted_at IS NULL',
    ];
    const values: unknown[] = [params.transactionDate, params.paymentMethodId];
    let idx = 3;

    if (params.branchId && params.branchName) {
      conditions.push(`(branch_id = $${idx} OR branch_name = $${idx + 1})`);
      values.push(params.branchId, params.branchName); idx += 2;
    } else if (params.branchId) {
      conditions.push(`branch_id = $${idx++}`); values.push(params.branchId);
    } else {
      conditions.push(`branch_name = $${idx++}`); values.push(params.branchName!);
    }

    const { rows } = await pool.query(
      `SELECT id FROM aggregated_transactions WHERE ${conditions.join(' AND ')} LIMIT 1`,
      values
    );
    return rows[0] ?? null;
  },

  async findAggregatedTxByPosSyncId(posSyncAggregateId: string) {
    const { rows } = await pool.query(
      `SELECT id FROM aggregated_transactions
       WHERE pos_sync_aggregate_id = $1 AND source_type = 'POS_SYNC' AND deleted_at IS NULL
       LIMIT 1`,
      [posSyncAggregateId]
    );
    return rows[0] ?? null;
  },

  async findBankStatementByReconciliationId(aggregatedTxId: string) {
    const { rows } = await pool.query(
      `SELECT id FROM bank_statements WHERE reconciliation_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [aggregatedTxId]
    );
    return rows[0] ?? null;
  },

  async getBankStatementById(statementId: number) {
    const { rows } = await pool.query(
      `SELECT id, credit_amount, debit_amount, is_reconciled FROM bank_statements WHERE id = $1`,
      [statementId]
    );
    return rows[0] ?? null;
  },

  async markBankStatementReconciled(statementId: number, reconciliationId: string) {
    await pool.query(
      `UPDATE bank_statements SET is_reconciled = true, reconciliation_id = $1, updated_at = NOW() WHERE id = $2`,
      [reconciliationId, statementId]
    );
  },

  async resetBankStatementReconciliation(statementId: number) {
    await pool.query(
      `UPDATE bank_statements SET is_reconciled = false, reconciliation_id = NULL, updated_at = NOW() WHERE id = $1`,
      [statementId]
    );
  },

  async markAggregatedTxReconciled(aggTxId: string, feeData: {
    actual_fee_amount: number; fee_discrepancy: number; fee_discrepancy_note: string | null;
  }) {
    await pool.query(
      `UPDATE aggregated_transactions
       SET is_reconciled = true, actual_fee_amount = $1, fee_discrepancy = $2,
           fee_discrepancy_note = $3, updated_at = NOW()
       WHERE id = $4`,
      [feeData.actual_fee_amount, feeData.fee_discrepancy, feeData.fee_discrepancy_note, aggTxId]
    );
  },

  async resetAggregatedTxReconciliation(posSyncAggregateId: string) {
    await pool.query(
      `UPDATE aggregated_transactions
       SET is_reconciled = false, actual_fee_amount = 0, fee_discrepancy = 0,
           fee_discrepancy_note = NULL, updated_at = NOW()
       WHERE pos_sync_aggregate_id = $1 AND source_type = 'POS_SYNC'`,
      [posSyncAggregateId]
    );
  },

  async getVoidAggregates(salesDate: string, branchId?: string | null) {
    const conditions = ["status = 'VOID'", 'sales_date = $1::date'];
    const values: unknown[] = [salesDate];
    let idx = 2;
    if (branchId) { conditions.push(`branch_id = $${idx++}`); values.push(branchId) }

    const { rows } = await pool.query(
      `SELECT * FROM pos_sync_aggregates WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      values
    );
    return rows;
  },

  async getVoidTransactionCount(salesDate: string) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(void_transaction_count), 0)::int AS total
       FROM pos_sync_aggregates WHERE status = 'VOID' AND sales_date = $1::date`,
      [salesDate]
    );
    return rows[0]?.total ?? 0;
  },

  async findVoidSalesDetails(salesNums: string[]) {
    if (salesNums.length === 0) return [];
    const { rows } = await pool.query(
      `SELECT sales_num, sales_date, sales_date_in, sales_date_out, branch_id, queue_num,
              pax_total, subtotal, discount_total, vat_total, grand_total, additional_info, created_by
       FROM tr_saleshead
       WHERE sales_num = ANY($1::text[]) AND status_id = 12
       ORDER BY sales_date_in DESC`,
      [salesNums]
    );
    return rows;
  },

  async getVoidSummary(startDate: string, endDate: string) {
    const { rows } = await pool.query(
      `SELECT sales_date, branch_id, branch_name, void_transaction_count, recalculated_count, updated_at
       FROM pos_sync_aggregates
       WHERE status = 'VOID' AND sales_date >= $1 AND sales_date <= $2
       ORDER BY sales_date DESC`,
      [startDate, endDate]
    );
    return rows;
  },

  async getRecentVoidActivity(daysBack: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const { rows } = await pool.query(
      `SELECT * FROM pos_sync_aggregates WHERE status = 'VOID' AND updated_at >= $1 ORDER BY updated_at DESC`,
      [startDate.toISOString()]
    );
    return rows;
  },
};
