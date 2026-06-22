import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type { PaymentMethodAlertGroup, CreateAlertGroupDto, UpdateAlertGroupDto } from './payment-method-alert-groups.types'

export class PaymentMethodAlertGroupsRepository {
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

  async findAll(companyIds: string[]): Promise<PaymentMethodAlertGroup[]> {
    if (!companyIds.length) return []
    const { rows } = await pool.query(
      `SELECT g.*,
              ARRAY(
                SELECT pm.name FROM payment_methods pm
                WHERE pm.id = ANY(g.payment_method_ids)
                ORDER BY pm.name
              ) AS payment_method_names
       FROM payment_method_alert_groups g
       WHERE g.company_id = ANY($1::uuid[]) AND g.deleted_at IS NULL
       ORDER BY g.name`,
      [companyIds]
    )
    return rows
  }

  async findActiveByCompany(companyId: string): Promise<PaymentMethodAlertGroup[]> {
    const { rows } = await pool.query(
      `SELECT g.*,
              ARRAY(
                SELECT pm.name FROM payment_methods pm
                WHERE pm.id = ANY(g.payment_method_ids)
                ORDER BY pm.name
              ) AS payment_method_names
       FROM payment_method_alert_groups g
       WHERE g.company_id = $1 AND g.is_active = true AND g.deleted_at IS NULL
       ORDER BY g.name`,
      [companyId]
    )
    return rows
  }

  async findByIdAccessible(id: string, companyIds: string[]): Promise<PaymentMethodAlertGroup | null> {
    if (!companyIds.length) return null
    const { rows } = await pool.query(
      `SELECT g.*,
              ARRAY(
                SELECT pm.name FROM payment_methods pm
                WHERE pm.id = ANY(g.payment_method_ids)
                ORDER BY pm.name
              ) AS payment_method_names
       FROM payment_method_alert_groups g
       WHERE g.id = $1 AND g.company_id = ANY($2::uuid[]) AND g.deleted_at IS NULL`,
      [id, companyIds]
    )
    return rows[0] || null
  }

  async create(companyId: string, dto: CreateAlertGroupDto, userId: string): Promise<PaymentMethodAlertGroup> {
    const { rows } = await pool.query(
      `INSERT INTO payment_method_alert_groups (company_id, name, payment_method_ids, threshold_amount, telegram_chat_id, is_active, created_by, updated_by)
       VALUES ($1, $2, $3::int[], $4, $5, $6, $7, $7)
       RETURNING *`,
      [companyId, dto.name, dto.payment_method_ids, dto.threshold_amount, dto.telegram_chat_id, dto.is_active ?? true, userId]
    )
    return rows[0]
  }

  async update(id: string, companyId: string, dto: UpdateAlertGroupDto, userId: string): Promise<PaymentMethodAlertGroup | null> {
    const fields: string[] = ['updated_by = $3', 'updated_at = NOW()']
    const values: unknown[] = [id, companyId, userId]
    let idx = 4

    if (dto.name !== undefined) { fields.push(`name = $${idx++}`); values.push(dto.name) }
    if (dto.payment_method_ids !== undefined) { fields.push(`payment_method_ids = $${idx++}::int[]`); values.push(dto.payment_method_ids) }
    if (dto.threshold_amount !== undefined) { fields.push(`threshold_amount = $${idx++}`); values.push(dto.threshold_amount) }
    if (dto.telegram_chat_id !== undefined) { fields.push(`telegram_chat_id = $${idx++}`); values.push(dto.telegram_chat_id) }
    if (dto.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(dto.is_active) }

    const { rows } = await pool.query(
      `UPDATE payment_method_alert_groups SET ${fields.join(', ')} WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING *`,
      values
    )
    return rows[0] || null
  }

  async softDelete(id: string, companyId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE payment_method_alert_groups SET deleted_at = NOW(), updated_by = $3, updated_at = NOW() WHERE id = $1 AND company_id = $2`,
      [id, companyId, userId]
    )
  }

  async updateLastTriggered(id: string, date: string, amount: number): Promise<void> {
    await pool.query(
      `UPDATE payment_method_alert_groups SET last_triggered_date = $2, last_triggered_amount = $3, updated_at = NOW() WHERE id = $1`,
      [id, date, amount]
    )
  }
}

export const paymentMethodAlertGroupsRepository = new PaymentMethodAlertGroupsRepository()
