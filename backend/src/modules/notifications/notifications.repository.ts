import { pool } from '../../config/db'
import type { NotificationRow, CreateNotificationInput } from './notifications.types'

export class NotificationsRepository {
  async create(input: CreateNotificationInput): Promise<NotificationRow> {
    const {
      companyId,
      recipientId,
      title,
      message,
      eventKey,
      type = 'info',
      category = 'system',
      data = {},
    } = input
    const { rows } = await pool.query(
      `INSERT INTO notifications (company_id, recipient_id, event_key, title, message, type, category, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [companyId, recipientId, eventKey ?? null, title, message, type, category, JSON.stringify(data)]
    )
    return rows[0]
  }

  async findAllForUser(
    userId: string,
    isRead?: boolean,
    limit = 20,
    offset = 0
  ): Promise<NotificationRow[]> {
    let query = 'SELECT * FROM notifications WHERE recipient_id = $1'
    const params: (string | boolean | number)[] = [userId]

    if (isRead !== undefined) {
      params.push(isRead)
      query += ` AND is_read = $${params.length}`
    }

    params.push(limit)
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`

    params.push(offset)
    query += ` OFFSET $${params.length}`

    const { rows } = await pool.query(query, params)
    return rows
  }

  async countUnreadForUser(userId: string): Promise<number> {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_id = $1 AND is_read = false',
      [userId]
    )
    return rows[0]?.count ?? 0
  }

  async findByIdAndUser(id: string, userId: string): Promise<NotificationRow | null> {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE id = $1 AND recipient_id = $2',
      [id, userId]
    )
    return rows[0] ?? null
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRow | null> {
    const { rows } = await pool.query(
      `UPDATE notifications 
       SET is_read = true, read_at = NOW(), updated_at = NOW() 
       WHERE id = $1 AND recipient_id = $2
       RETURNING *`,
      [id, userId]
    )
    return rows[0] ?? null
  }

  async markAllAsReadForUser(userId: string): Promise<void> {
    await pool.query(
      `UPDATE notifications 
       SET is_read = true, read_at = NOW(), updated_at = NOW() 
       WHERE recipient_id = $1 AND is_read = false`,
      [userId]
    )
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND recipient_id = $2',
      [id, userId]
    )
    return (rowCount ?? 0) > 0
  }
}
