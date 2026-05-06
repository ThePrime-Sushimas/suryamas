import { pool } from '../../config/db'
import type { PaymentMethodAlert, CreateAlertDto, UpdateAlertDto, DailyPaymentMethodTotal } from './payment-method-alerts.types'

export class PaymentMethodAlertsRepository {
  async findAll(companyId: string): Promise<PaymentMethodAlert[]> {
    const { rows } = await pool.query(
      `SELECT pma.*, pm.name AS payment_method_name
       FROM payment_method_alerts pma
       LEFT JOIN payment_methods pm ON pm.id = pma.payment_method_id
       WHERE pma.company_id = $1 AND pma.deleted_at IS NULL
       ORDER BY pm.name, pma.threshold_amount`,
      [companyId]
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
       WHERE at.transaction_date = $1
         AND at.company_id = $2
         AND at.deleted_at IS NULL
         AND at.superseded_by IS NULL
         AND at.status != 'FAILED'
       GROUP BY at.payment_method_id, pm.name, at.branch_name
       ORDER BY at.payment_method_id, daily_total DESC`,
      [salesDate, companyId]
    )
    return rows.map(r => ({ ...r, daily_total: Number(r.daily_total) }))
  }
}

export const paymentMethodAlertsRepository = new PaymentMethodAlertsRepository()
