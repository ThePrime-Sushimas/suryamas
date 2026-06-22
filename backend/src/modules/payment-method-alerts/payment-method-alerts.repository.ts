import { pool } from '../../config/db'
import type { PaymentMethodAlert, CreateAlertDto, UpdateAlertDto, DailyPaymentMethodTotal, PaymentMethodAlertHistory, BranchBreakdown, AlertHistoryFilters } from './payment-method-alerts.types'

export class PaymentMethodAlertsRepository {
  async findAll(companyIds: string[]): Promise<PaymentMethodAlert[]> {
    if (!companyIds.length) return []
    const { rows } = await pool.query(
      `SELECT pma.*, pm.name AS payment_method_name
       FROM payment_method_alerts pma
       LEFT JOIN payment_methods pm ON pm.id = pma.payment_method_id
       WHERE pma.company_id = ANY($1::uuid[]) AND pma.deleted_at IS NULL
       ORDER BY pm.name, pma.threshold_amount`,
      [companyIds]
    )
    return rows
  }

  async findActiveByCompany(companyId: string): Promise<PaymentMethodAlert[]> {
    const { rows } = await pool.query(
      `SELECT pma.*, pm.name AS payment_method_name
       FROM payment_method_alerts pma
       LEFT JOIN payment_methods pm ON pm.id = pma.payment_method_id
       WHERE pma.company_id = $1 AND pma.is_active = true AND pma.deleted_at IS NULL
       ORDER BY pma.payment_method_id`,
      [companyId]
    )
    return rows
  }

  async findByIdAccessible(id: string, companyIds: string[]): Promise<PaymentMethodAlert | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(
      `SELECT pma.*, pm.name AS payment_method_name
       FROM payment_method_alerts pma
       LEFT JOIN payment_methods pm ON pm.id = pma.payment_method_id
       WHERE pma.id = $1 AND pma.company_id = ANY($2::uuid[]) AND pma.deleted_at IS NULL`,
      [id, companyIds]
    )
    return rows[0] || null
  }

  async findById(id: string, companyId: string): Promise<PaymentMethodAlert | null> {
    const { rows } = await pool.query(
      `SELECT pma.*, pm.name AS payment_method_name
       FROM payment_method_alerts pma
       LEFT JOIN payment_methods pm ON pm.id = pma.payment_method_id
       WHERE pma.id = $1 AND pma.company_id = $2 AND pma.deleted_at IS NULL`,
      [id, companyId]
    )
    return rows[0] || null
  }

  async create(companyId: string, dto: CreateAlertDto, userId: string): Promise<PaymentMethodAlert> {
    const { rows } = await pool.query(
      `INSERT INTO payment_method_alerts (company_id, payment_method_id, threshold_amount, telegram_chat_id, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING *`,
      [companyId, dto.payment_method_id, dto.threshold_amount, dto.telegram_chat_id, dto.is_active ?? true, userId]
    )
    return rows[0]
  }

  async update(id: string, companyId: string, dto: UpdateAlertDto, userId: string): Promise<PaymentMethodAlert | null> {
    const fields: string[] = ['updated_by = $3', 'updated_at = NOW()']
    const values: unknown[] = [id, companyId, userId]
    let idx = 4

    if (dto.payment_method_id !== undefined) { fields.push(`payment_method_id = $${idx++}`); values.push(dto.payment_method_id) }
    if (dto.threshold_amount !== undefined) { fields.push(`threshold_amount = $${idx++}`); values.push(dto.threshold_amount) }
    if (dto.telegram_chat_id !== undefined) { fields.push(`telegram_chat_id = $${idx++}`); values.push(dto.telegram_chat_id) }
    if (dto.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(dto.is_active) }

    const { rows } = await pool.query(
      `UPDATE payment_method_alerts SET ${fields.join(', ')} WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING *`,
      values
    )
    return rows[0] || null
  }

  async softDelete(id: string, companyId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE payment_method_alerts SET deleted_at = NOW(), updated_by = $3, updated_at = NOW() WHERE id = $1 AND company_id = $2`,
      [id, companyId, userId]
    )
  }

  async updateLastTriggered(id: string, date: string, amount: number): Promise<void> {
    await pool.query(
      `UPDATE payment_method_alerts SET last_triggered_date = $2, last_triggered_amount = $3, updated_at = NOW() WHERE id = $1`,
      [id, date, amount]
    )
  }

  async getDailyTotals(companyId: string, salesDate: string): Promise<DailyPaymentMethodTotal[]> {
    const { rows } = await pool.query(
      `SELECT
        at.payment_method_id,
        pm.name AS payment_method_name,
        at.branch_name,
        SUM(at.nett_amount)::numeric AS daily_total
       FROM aggregated_transactions at
       JOIN payment_methods pm ON pm.id = at.payment_method_id
       JOIN branches b ON b.id = at.branch_id
       WHERE at.transaction_date = $1
         AND b.company_id = $2
         AND at.deleted_at IS NULL
         AND at.superseded_by IS NULL
         AND at.status != 'FAILED'
       GROUP BY at.payment_method_id, pm.name, at.branch_name
       ORDER BY at.payment_method_id, daily_total DESC`,
      [salesDate, companyId]
    )
    return rows.map(r => ({ ...r, daily_total: Number(r.daily_total) }))
  }

  // Alert History Methods
  async createHistory(data: {
    alert_id: string
    payment_method_id: number
    payment_method_name: string
    company_id: string
    triggered_date: string
    triggered_amount: number
    threshold_amount: number
    branch_breakdown: BranchBreakdown[]
    telegram_chat_id: string
  }): Promise<PaymentMethodAlertHistory> {
    const { rows } = await pool.query(
      `INSERT INTO payment_method_alert_history 
       (alert_id, payment_method_id, payment_method_name, company_id, triggered_date, triggered_amount, threshold_amount, branch_breakdown, telegram_chat_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.alert_id,
        data.payment_method_id,
        data.payment_method_name,
        data.company_id,
        data.triggered_date,
        data.triggered_amount,
        data.threshold_amount,
        JSON.stringify(data.branch_breakdown),
        data.telegram_chat_id
      ]
    )
    return rows[0]  // pg driver sudah parse JSONB otomatis
  }

  async getHistory(companyIds: string[], filters: AlertHistoryFilters = {}): Promise<{ data: PaymentMethodAlertHistory[], total: number }> {
    if (!companyIds.length) return { data: [], total: 0 }
    const { start_date, end_date, payment_method_id, page = 1, limit = 25 } = filters
    const offset = (page - 1) * limit
    
    let whereClause = 'WHERE h.company_id = ANY($1::uuid[])'
    const params: unknown[] = [companyIds]
    let paramIndex = 2

    if (start_date) {
      whereClause += ` AND h.triggered_date >= $${paramIndex++}`
      params.push(start_date)
    }
    if (end_date) {
      whereClause += ` AND h.triggered_date <= $${paramIndex++}`
      params.push(end_date)
    }
    if (payment_method_id) {
      // Only filter single alerts when payment_method_id specified; group alerts excluded
      whereClause += ` AND h.payment_method_id = $${paramIndex++}`
      params.push(payment_method_id)
    }

    // Get total count
    const countQuery = `SELECT COUNT(*)::int AS total FROM payment_method_alert_history h ${whereClause}`
    const { rows: countRows } = await pool.query(countQuery, params)
    const total = countRows[0].total

    // Get paginated data
    const limitIdx = paramIndex++
    const offsetIdx = paramIndex++
    const dataQuery = `
      SELECT h.*,
             a.is_active as alert_is_active,
             g.is_active as alert_group_is_active
      FROM payment_method_alert_history h
      LEFT JOIN payment_method_alerts a ON a.id = h.alert_id
      LEFT JOIN payment_method_alert_groups g ON g.id = h.alert_group_id
      ${whereClause}
      ORDER BY h.triggered_date DESC, h.telegram_sent_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `
    params.push(limit, offset)
    
    const { rows } = await pool.query(dataQuery, params)

    return { data: rows, total }
  }
  async getHistoryByIdAccessible(id: string, companyIds: string[]): Promise<PaymentMethodAlertHistory | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(
      `SELECT h.*,
              a.is_active as alert_is_active,
              g.is_active as alert_group_is_active
       FROM payment_method_alert_history h
       LEFT JOIN payment_method_alerts a ON a.id = h.alert_id
       LEFT JOIN payment_method_alert_groups g ON g.id = h.alert_group_id
       WHERE h.id = $1 AND h.company_id = ANY($2::uuid[])`,
      [id, companyIds]
    )
    if (rows.length === 0) return null
    return rows[0]
  }

  async getHistoryById(id: string, companyId: string): Promise<PaymentMethodAlertHistory | null> {
    const { rows } = await pool.query(
      `SELECT h.*,
              a.is_active as alert_is_active,
              g.is_active as alert_group_is_active
       FROM payment_method_alert_history h
       LEFT JOIN payment_method_alerts a ON a.id = h.alert_id
       LEFT JOIN payment_method_alert_groups g ON g.id = h.alert_group_id
       WHERE h.id = $1 AND h.company_id = $2`,
      [id, companyId]
    )
    if (rows.length === 0) return null
    return rows[0]
  }

  async createGroupHistory(data: {
    alert_group_id: string
    alert_group_name: string
    company_id: string
    triggered_date: string
    triggered_amount: number
    threshold_amount: number
    branch_breakdown: BranchBreakdown[]
    telegram_chat_id: string
  }): Promise<PaymentMethodAlertHistory> {
    const { rows } = await pool.query(
      `INSERT INTO payment_method_alert_history
       (alert_group_id, alert_group_name, payment_method_name, company_id, triggered_date, triggered_amount, threshold_amount, branch_breakdown, telegram_chat_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.alert_group_id,
        data.alert_group_name,
        data.alert_group_name, // payment_method_name as display fallback
        data.company_id,
        data.triggered_date,
        data.triggered_amount,
        data.threshold_amount,
        JSON.stringify(data.branch_breakdown),
        data.telegram_chat_id
      ]
    )
    return rows[0]
  }
}

export const paymentMethodAlertsRepository = new PaymentMethodAlertsRepository()
