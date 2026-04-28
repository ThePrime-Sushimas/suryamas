import { pool } from "../../../config/db";
import { logInfo, logError, logDebug } from "../../../config/logger";
import {
  AggregatedTransaction,
  ReconciliationAggregate,
  IReconciliationOrchestratorService,
} from "./reconciliation-orchestrator.types";

export class ReconciliationOrchestratorService implements IReconciliationOrchestratorService {
  async getAggregatesForDate(date: Date): Promise<ReconciliationAggregate[]> {
    const dateStr = date.toISOString().split("T")[0];
    logInfo("Fetching aggregated transactions for reconciliation", { date: dateStr });

    const { rows } = await pool.query(
      `SELECT at.*, pm.id AS pm_id, pm.name AS pm_name, pm.code AS pm_code
       FROM aggregated_transactions at
       LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
       WHERE at.transaction_date = $1 AND at.deleted_at IS NULL AND at.superseded_by IS NULL
       ORDER BY at.created_at DESC`,
      [dateStr]
    );

    return rows.map(agg => this.transformToReconciliationAggregate(agg));
  }

  async getAggregatesByDateRange(startDate: Date, endDate: Date): Promise<ReconciliationAggregate[]> {
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    const { rows } = await pool.query(
      `SELECT at.*, pm.name AS pm_name, pm.code AS pm_code
       FROM aggregated_transactions at
       LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
       WHERE at.transaction_date >= $1 AND at.transaction_date <= $2
         AND at.deleted_at IS NULL AND at.superseded_by IS NULL
       ORDER BY at.transaction_date DESC, at.created_at DESC`,
      [startDateStr, endDateStr]
    );

    return rows.map(agg => this.transformToReconciliationAggregate(agg));
  }

  async getAggregate(id: string): Promise<AggregatedTransaction> {
    const { rows } = await pool.query(
      `SELECT at.*, pm.name AS pm_name, pm.code AS pm_code
       FROM aggregated_transactions at
       LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
       WHERE at.id = $1`,
      [id]
    );
    if (rows.length === 0) throw new Error(`Aggregated transaction ${id} not found`);
    const r = rows[0];
    r.payment_methods = r.pm_name ? { name: r.pm_name, code: r.pm_code } : null;
    return r;
  }

  async updateReconciliationStatus(
    aggregateId: string,
    status: "PENDING" | "RECONCILED" | "DISCREPANCY",
    _statementId?: string,
    _reconciledBy?: string,
  ): Promise<void> {
    await pool.query(
      `UPDATE aggregated_transactions SET is_reconciled = $1, updated_at = NOW() WHERE id = $2`,
      [status === "RECONCILED", aggregateId]
    );
  }

  async getReconciliationSummary(startDate: Date, endDate: Date): Promise<Record<string, unknown>> {
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];
    return this.getSummaryFallback(startDateStr, endDateStr);
  }

  private async getSummaryFallback(startDate: string, endDate: string): Promise<Record<string, unknown>> {
    const [aggRes, stmtRes] = await Promise.all([
      pool.query(
        `SELECT is_reconciled, nett_amount FROM aggregated_transactions
         WHERE transaction_date >= $1 AND transaction_date <= $2
           AND deleted_at IS NULL AND superseded_by IS NULL`,
        [startDate, endDate]
      ),
      pool.query(
        `SELECT id, is_reconciled, credit_amount, debit_amount, reconciliation_id
         FROM bank_statements
         WHERE transaction_date >= $1 AND transaction_date <= $2 AND deleted_at IS NULL`,
        [startDate, endDate]
      ),
    ]);

    const aggData = aggRes.rows;
    const stmtData = stmtRes.rows;

    const totalAggregates = aggData.length;
    const reconciledAggregates = aggData.filter(a => a.is_reconciled).length;
    const totalStatements = stmtData.length;
    const reconciledStatements = stmtData.filter(s => s.is_reconciled).length;
    const unreconciled = totalStatements - reconciledStatements;

    const totalNetAmount = aggData.reduce((s, a) => s + (Number(a.nett_amount) || 0), 0);
    const totalBankAmount = stmtData.reduce((s, st) => s + ((Number(st.credit_amount) || 0) - (Number(st.debit_amount) || 0)), 0);
    const totalDifference = Math.abs(totalNetAmount - totalBankAmount);
    const percentageReconciled = totalAggregates > 0 ? (reconciledAggregates / totalAggregates) * 100 : 0;

    return {
      period: { startDate, endDate },
      totalAggregates, totalStatements,
      autoMatched: 0, manuallyMatched: 0, discrepancies: 0,
      unreconciled, totalDifference, percentageReconciled,
    };
  }

  private transformToReconciliationAggregate(agg: Record<string, unknown>): ReconciliationAggregate {
    return {
      id: agg.id as string,
      nett_amount: Number(agg.nett_amount),
      actual_nett_amount: Number((agg.actual_nett_amount ?? agg.nett_amount) as number),
      transaction_date: agg.transaction_date as string,
      reference_number: agg.source_ref as string,
      payment_method_id: agg.payment_method_id as number,
      payment_method_name: (agg.pm_name as string) || undefined,
      branch_name: (agg.branch_name as string) || undefined,
      gross_amount: Number(agg.gross_amount),
      percentage_fee_amount: Number(agg.percentage_fee_amount || 0),
      fixed_fee_amount: Number(agg.fixed_fee_amount || 0),
      total_fee_amount: Number(agg.total_fee_amount || 0),
      bill_after_discount: Number(agg.bill_after_discount || 0),
      transaction_count: 1,
      reconciliation_status: (agg.is_reconciled as boolean) ? "RECONCILED" : "PENDING",
    };
  }

  async findPotentialAggregatesForStatement(
    statementAmount: number, statementDate: Date,
    tolerance: number = 0.01, dateBufferDays: number = 3,
  ): Promise<ReconciliationAggregate[]> {
    const minDate = new Date(statementDate); minDate.setDate(minDate.getDate() - dateBufferDays);
    const maxDate = new Date(statementDate); maxDate.setDate(maxDate.getDate() + dateBufferDays);

    const { rows } = await pool.query(
      `SELECT at.*, pm.name AS pm_name
       FROM aggregated_transactions at
       LEFT JOIN payment_methods pm ON pm.id = at.payment_method_id
       WHERE at.transaction_date >= $1 AND at.transaction_date <= $2
         AND at.deleted_at IS NULL AND at.superseded_by IS NULL
         AND at.is_reconciled = false
         AND at.nett_amount >= $3 AND at.nett_amount <= $4
       ORDER BY at.transaction_date DESC LIMIT 10`,
      [minDate.toISOString().split("T")[0], maxDate.toISOString().split("T")[0],
       statementAmount - tolerance, statementAmount + tolerance]
    );

    return rows.map(agg => {
      const netAmount = Number(agg.nett_amount);
      const amountDiff = Math.abs(netAmount - statementAmount);
      const dateDiff = Math.abs(new Date(agg.transaction_date).getTime() - statementDate.getTime()) / (1000 * 3600 * 24);
      let score = Math.max(0, Math.min(100, Math.round(100 - (amountDiff / (statementAmount || 1)) * 1000 - dateDiff * 5)));

      return {
        ...this.transformToReconciliationAggregate(agg),
        confidence_score: score,
        amount_difference: amountDiff,
        date_difference_days: dateDiff,
      };
    }).sort((a, b) => b.confidence_score - a.confidence_score);
  }

  async bulkUpdateReconciliationStatus(
    updates: Array<{ aggregateId: string; status: "PENDING" | "RECONCILED" | "DISCREPANCY"; statementId?: string }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    const reconciled = updates.filter(u => u.status === "RECONCILED").map(u => u.aggregateId);
    const unreconciled = updates.filter(u => u.status !== "RECONCILED").map(u => u.aggregateId);

    const ops: Promise<void>[] = [];
    if (reconciled.length > 0) {
      ops.push(pool.query(
        `UPDATE aggregated_transactions SET is_reconciled = true, updated_at = NOW() WHERE id = ANY($1::uuid[])`,
        [reconciled]
      ).then(() => {}));
    }
    if (unreconciled.length > 0) {
      ops.push(pool.query(
        `UPDATE aggregated_transactions SET is_reconciled = false, updated_at = NOW() WHERE id = ANY($1::uuid[])`,
        [unreconciled]
      ).then(() => {}));
    }
    await Promise.all(ops);
  }
}

export const reconciliationOrchestratorService = new ReconciliationOrchestratorService();
