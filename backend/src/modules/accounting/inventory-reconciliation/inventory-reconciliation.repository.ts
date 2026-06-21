import { pool } from '../../../config/db'
import type { InventoryReconciliationRow, UnjournaledWasteRow, UnjournaledShortageRow, InventoryReconciliationParams } from './inventory-reconciliation.types'

export class InventoryReconciliationRepository {

  /**
   * Stock subledger value per branch: SUM(qty * avg_cost) from stock_balances.
   * Only includes active warehouses.
   */
  async getSubledgerByBranch(params: InventoryReconciliationParams): Promise<Map<string, { branch_name: string; value: number }>> {
    const { rows } = await pool.query(
      `SELECT
        w.branch_id,
        b.branch_name,
        COALESCE(SUM(sb.qty * sb.avg_cost), 0)::numeric AS subledger_value
       FROM stock_balances sb
       JOIN warehouses w ON w.id = sb.warehouse_id
       JOIN branches b ON b.id = w.branch_id
       WHERE w.deleted_at IS NULL
         AND w.branch_id = ANY($1::uuid[])
         AND b.company_id = ANY($2::uuid[])
       GROUP BY w.branch_id, b.branch_name
       ORDER BY b.branch_name`,
      [params.branchIds, params.companyIds]
    )

    const map = new Map<string, { branch_name: string; value: number }>()
    for (const row of rows) {
      map.set(row.branch_id, {
        branch_name: row.branch_name,
        value: Number(row.subledger_value),
      })
    }
    return map
  }

  /**
   * GL balance per branch for inventory accounts (110501, 110502, 110505, 110598).
   * Uses journal_headers with status = 'POSTED' and journal_date <= as_of_date.
   * Returns net balance (debit - credit) per branch.
   */
  async getGlBalanceByBranch(params: InventoryReconciliationParams): Promise<Map<string, { branch_name: string; value: number }>> {
    const { rows } = await pool.query(
      `SELECT
        jh.branch_id,
        b.branch_name,
        COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)::numeric AS gl_balance
       FROM journal_lines jl
       JOIN journal_headers jh ON jh.id = jl.journal_header_id
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       JOIN branches b ON b.id = jh.branch_id
       WHERE coa.account_code IN ('110501', '110502', '110505', '110598')
         AND jh.status = 'POSTED'
         AND jh.deleted_at IS NULL
         AND jh.company_id = ANY($1::uuid[])
         AND jh.branch_id = ANY($2::uuid[])
         AND jh.journal_date <= $3::date
       GROUP BY jh.branch_id, b.branch_name
       ORDER BY b.branch_name`,
      [params.companyIds, params.branchIds, params.asOfDate]
    )

    const map = new Map<string, { branch_name: string; value: number }>()
    for (const row of rows) {
      map.set(row.branch_id, {
        branch_name: row.branch_name,
        value: Number(row.gl_balance),
      })
    }
    return map
  }

  /**
   * Unjournaled waste: WASTE classification entries that have no corresponding
   * CONFIRMED stock_adjustment with source_closing_id.
   * These represent GL drift — stock was reduced at opname but no journal was posted.
   */
  async getUnjournaledWaste(params: InventoryReconciliationParams): Promise<UnjournaledWasteRow[]> {
    const { rows } = await pool.query(
      `SELECT
        dcc.id AS closing_id,
        dcc.closing_date::text AS closing_date,
        dcc.branch_id,
        b.branch_name,
        pos.position_name,
        COUNT(vcl.id)::int AS waste_line_count,
        COALESCE(SUM(vcl.qty * dccl.cost_per_unit), 0)::numeric AS unjournaled_waste_value
       FROM variance_classification_lines vcl
       JOIN daily_closing_count_lines dccl ON dccl.id = vcl.line_id
       JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
       JOIN branches b ON b.id = dcc.branch_id
       LEFT JOIN positions pos ON pos.id = dcc.position_id
       WHERE vcl.variance_category = 'WASTE'
         AND dcc.is_deleted = false
         AND dcc.branch_id = ANY($1::uuid[])
         AND b.company_id = ANY($2::uuid[])
         AND dcc.closing_date <= $3::date
         AND NOT EXISTS (
           SELECT 1 FROM stock_adjustments sa
           WHERE sa.source_closing_id = dcc.id
             AND sa.status = 'CONFIRMED'
             AND sa.deleted_at IS NULL
         )
       GROUP BY dcc.id, dcc.closing_date, dcc.branch_id, b.branch_name, pos.position_name
       ORDER BY dcc.closing_date DESC, b.branch_name`,
      [params.branchIds, params.companyIds, params.asOfDate]
    )

    return rows.map(r => ({
      closing_id: r.closing_id,
      closing_date: r.closing_date,
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      position_name: r.position_name ?? null,
      waste_line_count: Number(r.waste_line_count),
      unjournaled_waste_value: Number(r.unjournaled_waste_value),
    }))
  }

  /**
   * Unjournaled shortage: SHORTAGE entries that have been resolved (deduction_amount > 0)
   * but shortage_journal_id is NULL — meaning the journal generation failed or was skipped.
   * These represent GL drift from the B2 path.
   */
  async getUnjournaledShortage(params: InventoryReconciliationParams): Promise<UnjournaledShortageRow[]> {
    const { rows } = await pool.query(
      `SELECT
        vcl.id AS vcl_id,
        COALESCE(dcc.closing_date, mso.opname_date)::text AS closing_date,
        COALESCE(dcc.branch_id, mso.branch_id) AS branch_id,
        b.branch_name,
        COALESCE(dccl.product_id, msol.product_id) AS product_id,
        vcl.resolve_status,
        vcl.deduction_amount
       FROM variance_classification_lines vcl
       LEFT JOIN daily_closing_count_lines dccl ON dccl.id = vcl.line_id
       LEFT JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
       LEFT JOIN monthly_stock_opname_lines msol ON msol.id = vcl.monthly_opname_line_id
       LEFT JOIN monthly_stock_opname mso ON mso.id = vcl.monthly_opname_id
       LEFT JOIN branches b ON b.id = COALESCE(dcc.branch_id, mso.branch_id)
       WHERE vcl.variance_category = 'SHORTAGE'
         AND vcl.resolve_status = 'RESOLVED'
         AND vcl.deduction_amount > 0
         AND vcl.shortage_journal_id IS NULL
         AND COALESCE(dcc.branch_id, mso.branch_id) IS NOT NULL
         AND COALESCE(dcc.branch_id, mso.branch_id) = ANY($1::uuid[])
         AND b.company_id = ANY($2::uuid[])
         AND COALESCE(dcc.closing_date, mso.opname_date) <= $3::date
       ORDER BY COALESCE(dcc.closing_date, mso.opname_date) DESC, b.branch_name`,
      [params.branchIds, params.companyIds, params.asOfDate]
    )

    return rows.map(r => ({
      vcl_id: r.vcl_id,
      closing_date: r.closing_date,
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      product_id: r.product_id,
      resolve_status: r.resolve_status,
      deduction_amount: Number(r.deduction_amount),
    }))
  }
}

export const inventoryReconciliationRepository = new InventoryReconciliationRepository()
