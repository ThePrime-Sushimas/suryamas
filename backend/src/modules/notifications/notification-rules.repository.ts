import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type { NotificationRuleRow, NotificationRuleUpsertDto } from './notification-rules.types'
import { getEventDefinition } from './notification-events'

function resolveRuleFields(dto: NotificationRuleUpsertDto) {
  const def = getEventDefinition(dto.event_key)
  return {
    titleTemplate: dto.title_template ?? def?.default_title_template ?? 'Notifikasi',
    messageTemplate: dto.message_template ?? def?.default_message_template ?? '',
    type: dto.type ?? def?.default_type ?? 'info',
    category: def?.category ?? 'system',
    redirectUrlTemplate: dto.redirect_url_template ?? def?.default_redirect_url_template ?? null,
    isActive: dto.is_active && dto.position_id != null,
  }
}

export class NotificationRulesRepository {
  async findByCompany(companyId: string): Promise<NotificationRuleRow[]> {
    const { rows } = await pool.query(
      `SELECT nr.*, p.position_name, p.position_code
       FROM notification_rules nr
       LEFT JOIN positions p ON p.id = nr.position_id AND p.deleted_at IS NULL
       WHERE nr.company_id = $1
       ORDER BY nr.event_key`,
      [companyId]
    )
    return rows
  }

  async findActiveByEvent(companyId: string, eventKey: string): Promise<NotificationRuleRow | null> {
    const { rows } = await pool.query(
      `SELECT nr.*
       FROM notification_rules nr
       WHERE nr.company_id = $1 AND nr.event_key = $2 AND nr.is_active = true AND nr.position_id IS NOT NULL`,
      [companyId, eventKey]
    )
    return rows[0] ?? null
  }

  async findUserIdsByPosition(companyId: string, positionId: string): Promise<string[]> {
    const { rows } = await pool.query(
      `SELECT DISTINCT e.user_id
       FROM employee_positions ep
       JOIN employees e ON e.id = ep.employee_id AND e.deleted_at IS NULL AND e.is_active = true
       JOIN positions p ON p.id = ep.position_id AND p.company_id = $1 AND p.deleted_at IS NULL
       WHERE ep.position_id = $2
         AND ep.is_deleted = false
         AND e.user_id IS NOT NULL`,
      [companyId, positionId]
    )
    return rows.map((r: { user_id: string }) => r.user_id)
  }

  private async upsertOne(
    client: PoolClient,
    companyId: string,
    dto: NotificationRuleUpsertDto,
    userId: string
  ): Promise<NotificationRuleRow> {
    const {
      titleTemplate,
      messageTemplate,
      type,
      category,
      redirectUrlTemplate,
      isActive,
    } = resolveRuleFields(dto)

    const { rows } = await client.query(
      `INSERT INTO notification_rules (
         company_id, event_key, position_id, title_template, message_template,
         type, category, redirect_url_template, is_active, created_by, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       ON CONFLICT (company_id, event_key)
       DO UPDATE SET
         position_id = EXCLUDED.position_id,
         title_template = EXCLUDED.title_template,
         message_template = EXCLUDED.message_template,
         type = EXCLUDED.type,
         category = EXCLUDED.category,
         redirect_url_template = EXCLUDED.redirect_url_template,
         is_active = EXCLUDED.is_active,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING *`,
      [
        companyId,
        dto.event_key,
        dto.position_id,
        titleTemplate,
        messageTemplate,
        type,
        category,
        redirectUrlTemplate,
        isActive,
        userId,
      ]
    )
    return rows[0]
  }

  async upsert(
    companyId: string,
    dto: NotificationRuleUpsertDto,
    userId: string
  ): Promise<NotificationRuleRow> {
    const client = await pool.connect()
    try {
      return await this.upsertOne(client, companyId, dto, userId)
    } finally {
      client.release()
    }
  }

  /**
   * Batch upsert dalam satu transaksi.
   * WAJIB sequential — satu PoolClient tidak boleh query paralel (hasil bisa tertukar).
   */
  async upsertMany(
    companyId: string,
    rules: NotificationRuleUpsertDto[],
    userId: string
  ): Promise<void> {
    if (rules.length === 0) return

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const dto of rules) {
        await this.upsertOne(client, companyId, dto, userId)
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}

export const notificationRulesRepository = new NotificationRulesRepository()
