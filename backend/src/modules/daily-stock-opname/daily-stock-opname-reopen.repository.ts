import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  OpnameReopenRequest,
  OpnameReopenRequestWithRelations,
} from './daily-stock-opname-reopen.types'

// ─── REOPEN REPOSITORY ────────────────────────────────────────────────────────

export class DailyStockOpnameReopenRepository {

  // ─── TRANSACTION WRAPPER ──────────────────────────────────────────────────────

  async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // ─── INSERT ─────────────────────────────────────────────────────────────────

  async insertRequest(
    client: PoolClient,
    data: { closing_id: string; requested_by: string; reason: string },
  ): Promise<OpnameReopenRequest> {
    const { rows } = await client.query(
      `INSERT INTO opname_reopen_requests (closing_id, requested_by, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.closing_id, data.requested_by, data.reason],
    )
    return rows[0]
  }

  /**
   * Direct insert without requiring a transaction client.
   * Used for single-insert scenarios where a transaction wrapper is unnecessary.
   */
  async insertRequestDirect(
    data: { closing_id: string; requested_by: string; reason: string },
  ): Promise<OpnameReopenRequest> {
    const { rows } = await pool.query(
      `INSERT INTO opname_reopen_requests (closing_id, requested_by, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.closing_id, data.requested_by, data.reason],
    )
    return rows[0]
  }

  // ─── FIND QUERIES ───────────────────────────────────────────────────────────

  async findPendingByClosingId(closingId: string): Promise<OpnameReopenRequest | null> {
    const { rows } = await pool.query(
      `SELECT * FROM opname_reopen_requests
       WHERE closing_id = $1 AND status = 'PENDING'
       LIMIT 1`,
      [closingId],
    )
    return rows[0] ?? null
  }

  async findById(requestId: string): Promise<OpnameReopenRequest | null> {
    const { rows } = await pool.query(
      `SELECT * FROM opname_reopen_requests WHERE id = $1`,
      [requestId],
    )
    return rows[0] ?? null
  }

  async findByIdWithRelations(requestId: string): Promise<OpnameReopenRequestWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT
        orr.*,
        req_emp.full_name AS requested_by_name,
        resp_emp.full_name AS responded_by_name,
        dcc.closing_date,
        b.branch_name
      FROM opname_reopen_requests orr
      JOIN daily_closing_counts dcc ON dcc.id = orr.closing_id
      JOIN branches b ON b.id = dcc.branch_id
      LEFT JOIN employees req_emp ON req_emp.user_id = orr.requested_by
      LEFT JOIN employees resp_emp ON resp_emp.user_id = orr.responded_by
      WHERE orr.id = $1`,
      [requestId],
    )
    return rows[0] ?? null
  }

  async findByClosingId(closingId: string): Promise<OpnameReopenRequestWithRelations[]> {
    const { rows } = await pool.query(
      `SELECT
        orr.*,
        req_emp.full_name AS requested_by_name,
        resp_emp.full_name AS responded_by_name,
        dcc.closing_date,
        b.branch_name
      FROM opname_reopen_requests orr
      JOIN daily_closing_counts dcc ON dcc.id = orr.closing_id
      JOIN branches b ON b.id = dcc.branch_id
      LEFT JOIN employees req_emp ON req_emp.user_id = orr.requested_by
      LEFT JOIN employees resp_emp ON resp_emp.user_id = orr.responded_by
      WHERE orr.closing_id = $1
      ORDER BY orr.requested_at DESC`,
      [closingId],
    )
    return rows
  }

  // ─── UPDATE ─────────────────────────────────────────────────────────────────

  async updateStatus(
    client: PoolClient,
    requestId: string,
    data: {
      status: 'APPROVED' | 'REJECTED'
      responded_by: string
      responded_at: string
      response_note: string | null
    },
  ): Promise<void> {
    await client.query(
      `UPDATE opname_reopen_requests
       SET status = $1, responded_by = $2, responded_at = $3, response_note = $4, updated_at = now()
       WHERE id = $5`,
      [data.status, data.responded_by, data.responded_at, data.response_note, requestId],
    )
  }

  // ─── STOCK MOVEMENT QUERIES ─────────────────────────────────────────────────

  /**
   * Get all stock movements created by the original confirm flow for this session.
   * These are the movements that need to be reversed on reopen approval.
   */
  async getMovementsByClosingId(
    client: PoolClient,
    closingId: string,
  ): Promise<{ product_id: string; movement_type: string; qty: number; cost_per_unit: number }[]> {
    const { rows } = await client.query(
      `SELECT product_id, movement_type, qty, cost_per_unit
       FROM stock_movements
       WHERE reference_type = 'daily_closing_count'
         AND reference_id = $1
         AND movement_type IN ('OUT_WASTE', 'IN_ADJUSTMENT')`,
      [closingId],
    )
    return rows
  }
}

export const reopenRepository = new DailyStockOpnameReopenRepository()
