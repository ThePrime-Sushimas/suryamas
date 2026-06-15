import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  ClassificationEntry,
  ClassificationSummary,
  InsertClassificationEntry,
} from './daily-stock-opname.types'

// ─── CLASSIFICATION REPOSITORY ────────────────────────────────────────────────

export class DailyStockOpnameClassificationRepository {

  /**
   * Delete all classification entries for a closing session.
   * Used as part of the replace strategy (delete old → insert new).
   * Runs within a transaction via the provided PoolClient.
   */
  async deleteByClosingId(client: PoolClient, closingId: string): Promise<void> {
    await client.query(
      `DELETE FROM variance_classification_lines WHERE closing_id = $1`,
      [closingId],
    )
  }

  /**
   * Batch insert classification entries using a single parameterized query.
   * Runs within a transaction via the provided PoolClient.
   */
  async insertEntries(client: PoolClient, entries: InsertClassificationEntry[]): Promise<void> {
    if (entries.length === 0) return

    const valueRows: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (const entry of entries) {
      valueRows.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8})`,
      )
      params.push(
        entry.closing_id,
        entry.line_id,
        entry.variance_category,
        entry.qty,
        entry.shortage_assigned_to,
        entry.shortage_note,
        entry.classified_by,
        entry.company_id,
        entry.branch_id,
      )
      idx += 9
    }

    await client.query(
      `INSERT INTO variance_classification_lines
        (closing_id, line_id, variance_category, qty, shortage_assigned_to, shortage_note, classified_by, company_id, branch_id)
       VALUES ${valueRows.join(', ')}`,
      params,
    )
  }

  /**
   * Fetch all classification entries for a closing session with joined employee names
   * and product info from the opname lines table.
   * Used by getClassifications service method.
   */
  async findByClosingId(closingId: string, branchIds: string[]): Promise<ClassificationEntry[]> {
    const { rows } = await pool.query(
      `SELECT
        vcl.id,
        vcl.closing_id,
        vcl.line_id,
        vcl.variance_category,
        vcl.qty,
        vcl.shortage_assigned_to,
        vcl.shortage_note,
        vcl.classified_by,
        vcl.classified_at,
        vcl.company_id,
        vcl.branch_id,
        dccl.product_name,
        dccl.product_code,
        dccl.uom,
        e.full_name AS assigned_employee_name
      FROM variance_classification_lines vcl
      JOIN daily_closing_count_lines dccl ON dccl.id = vcl.line_id
      JOIN daily_closing_counts dcc ON dcc.id = vcl.closing_id
      LEFT JOIN employees e ON e.id = vcl.shortage_assigned_to
      WHERE vcl.closing_id = $1
        AND dcc.branch_id = ANY($2::uuid[])
        AND dcc.is_deleted = false
      ORDER BY dccl.sort_order, dccl.product_name`,
      [closingId, branchIds],
    )

    return rows
  }

  /**
   * Get classification summary for a closing session.
   * Returns waste_total, shortage_total, entry_count, is_complete flag, and classification_version.
   *
   * is_complete: true when ALL negative-variance lines have their total classified qty
   * equal to ABS(variance_qty). If any negative-variance line has remaining unclassified qty,
   * is_complete = false.
   */
  async getSummary(closingId: string): Promise<ClassificationSummary> {
    // Split into two queries to avoid cartesian product between negative_lines and vcl rows
    // Query 1: is_complete check
    const { rows: completenessRows } = await pool.query(
      `WITH negative_lines AS (
        SELECT id, ABS(variance_qty) AS abs_variance
        FROM daily_closing_count_lines
        WHERE closing_id = $1 AND variance_qty < 0
      ),
      classified AS (
        SELECT line_id, SUM(qty) AS classified_qty
        FROM variance_classification_lines
        WHERE closing_id = $1
        GROUP BY line_id
      )
      SELECT
        COALESCE(BOOL_AND(COALESCE(c.classified_qty, 0) = nl.abs_variance), true) AS is_complete
      FROM negative_lines nl
      LEFT JOIN classified c ON c.line_id = nl.id`,
      [closingId],
    )

    // Query 2: aggregate totals from vcl directly
    const { rows } = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN variance_category = 'WASTE' THEN qty END), 0) AS waste_total,
        COALESCE(SUM(CASE WHEN variance_category = 'SHORTAGE' THEN qty END), 0) AS shortage_total,
        COUNT(id) AS entry_count
      FROM variance_classification_lines
      WHERE closing_id = $1`,
      [closingId],
    )

    const { rows: sessionRows } = await pool.query(
      `SELECT classification_version FROM daily_closing_counts WHERE id = $1`,
      [closingId],
    )

    return {
      waste_total: Number(rows[0]?.waste_total ?? 0),
      shortage_total: Number(rows[0]?.shortage_total ?? 0),
      entry_count: Number(rows[0]?.entry_count ?? 0),
      is_complete: completenessRows[0]?.is_complete ?? false,
      classification_version: Number(sessionRows[0]?.classification_version ?? 0),
    }
  }
}

export const classificationRepository = new DailyStockOpnameClassificationRepository()
