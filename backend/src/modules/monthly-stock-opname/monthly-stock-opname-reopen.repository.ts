import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  MonthlyOpnameReopenRequest,
  MonthlyOpnameReopenRequestWithRelations,
} from './monthly-stock-opname.types'

// ─── REOPEN REPOSITORY ────────────────────────────────────────────────────────

export class MonthlyOpnameReopenRepository {

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

  async insertRequestDirect(
    data: { opname_id: string; requested_by: string; reason: string },
  ): Promise<MonthlyOpnameReopenRequest> {
    const { rows } = await pool.query(
      `INSERT INTO monthly_opname_reopen_requests (opname_id, requested_by, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.opname_id, data.requested_by, data.reason],
    )
    return rows[0]
  }

  // ─── FIND QUERIES ───────────────────────────────────────────────────────────

  async findPendingByOpnameId(opnameId: string): Promise<MonthlyOpnameReopenRequest | null> {
    const { rows } = await pool.query(
      `SELECT * FROM monthly_opname_reopen_requests
       WHERE opname_id = $1 AND status = 'PENDING'
       LIMIT 1`,
      [opnameId],
    )
    return rows[0] ?? null
  }

  async findById(requestId: string): Promise<MonthlyOpnameReopenRequest | null> {
    const { rows } = await pool.query(
      `SELECT * FROM monthly_opname_reopen_requests WHERE id = $1`,
      [requestId],
    )
    return rows[0] ?? null
  }

  async findByIdWithRelations(requestId: string): Promise<MonthlyOpnameReopenRequestWithRelations | null> {
    const { rows } = await pool.query(
      `SELECT
        orr.*,
        req_emp.full_name AS requested_by_name,
        resp_emp.full_name AS responded_by_name,
        mso.opname_date,
        b.branch_name
      FROM monthly_opname_reopen_requests orr
      JOIN monthly_stock_opname mso ON mso.id = orr.opname_id
      JOIN branches b ON b.id = mso.branch_id
      LEFT JOIN employees req_emp ON req_emp.user_id = orr.requested_by
      LEFT JOIN employees resp_emp ON resp_emp.user_id = orr.responded_by
      WHERE orr.id = $1`,
      [requestId],
    )
    return rows[0] ?? null
  }

  async findByOpnameId(opnameId: string): Promise<MonthlyOpnameReopenRequestWithRelations[]> {
    const { rows } = await pool.query(
      `SELECT
        orr.*,
        req_emp.full_name AS requested_by_name,
        resp_emp.full_name AS responded_by_name,
        mso.opname_date,
        b.branch_name
      FROM monthly_opname_reopen_requests orr
      JOIN monthly_stock_opname mso ON mso.id = orr.opname_id
      JOIN branches b ON b.id = mso.branch_id
      LEFT JOIN employees req_emp ON req_emp.user_id = orr.requested_by
      LEFT JOIN employees resp_emp ON resp_emp.user_id = orr.responded_by
      WHERE orr.opname_id = $1
      ORDER BY orr.requested_at DESC`,
      [opnameId],
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
      `UPDATE monthly_opname_reopen_requests
       SET status = $1, responded_by = $2, responded_at = $3, response_note = $4, updated_at = now()
       WHERE id = $5`,
      [data.status, data.responded_by, data.responded_at, data.response_note, requestId],
    )
  }

  /**
   * Direct status update without requiring a transaction client.
   * For simple reject operations where no other writes are needed.
   */
  async updateStatusDirect(
    requestId: string,
    data: {
      status: 'APPROVED' | 'REJECTED'
      responded_by: string
      responded_at: string
      response_note: string | null
    },
  ): Promise<void> {
    await pool.query(
      `UPDATE monthly_opname_reopen_requests
       SET status = $1, responded_by = $2, responded_at = $3, response_note = $4, updated_at = now()
       WHERE id = $5`,
      [data.status, data.responded_by, data.responded_at, data.response_note, requestId],
    )
  }
}

export const monthlyOpnameReopenRepository = new MonthlyOpnameReopenRepository()
