import { NotificationsRepository } from './notifications.repository'
import { NotificationErrors } from './notifications.errors'
import { notifyError } from '../../services/webhook-notifier.service'
import { logInfo, logError } from '../../config/logger'
import { sendRealTimeNotification } from '../../services/socket.service'
import type { CreateNotificationInput, NotificationRow, RealtimeNotificationPayload } from './notifications.types'

function toRealtimePayload(row: NotificationRow): RealtimeNotificationPayload {
  return {
    id: row.id,
    recipient_id: row.recipient_id,
    title: row.title,
    message: row.message,
    type: row.type,
    category: row.category,
    is_read: row.is_read,
    read_at: row.read_at ? new Date(row.read_at).toISOString() : null,
    data: (row.data ?? {}) as Record<string, unknown>,
    created_at: new Date(row.created_at).toISOString(),
  }
}

export class NotificationsService {
  private repository: NotificationsRepository

  constructor() {
    this.repository = new NotificationsRepository()
  }

  async createNotification(input: CreateNotificationInput): Promise<NotificationRow> {
    try {
      const notification = await this.repository.create(input)
      logInfo('Notification created successfully', { 
        id: notification.id, 
        recipient: notification.recipient_id, 
        category: notification.category 
      })

      // Kirim real-time WebSocket push via Socket.IO
      try {
        sendRealTimeNotification(input.recipientId, toRealtimePayload(notification))
      } catch (wsErr) {
        logError('Failed to dispatch Socket.IO notification', { 
          error: wsErr instanceof Error ? wsErr.message : String(wsErr) 
        })
      }

      // Webhook ops: hanya untuk type error yang bukan alur bisnis rutin (dispatch pakai warning/success)
      if (input.type === 'error') {
        notifyError({
          severity: 'HIGH',
          module: `NOTIFIKASI: ${input.category?.toUpperCase() || 'SYSTEM'}`,
          route: '/api/v1/notifications',
          url: '',
          message: `[${input.title}] ${input.message}`,
          timestamp: new Date().toISOString(),
          userId: input.recipientId,
        })
      }

      return notification;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown'
      logError('Failed to create notification', { error: msg })
      throw NotificationErrors.CREATE_FAILED(msg)
    }
  }

  async getNotificationsForUser(
    userId: string,
    isRead?: boolean,
    limit?: number,
    offset?: number
  ): Promise<NotificationRow[]> {
    return this.repository.findAllForUser(userId, isRead, limit, offset)
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.countUnreadForUser(userId)
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRow> {
    const existing = await this.repository.findByIdAndUser(id, userId)
    if (!existing) {
      throw NotificationErrors.NOT_FOUND(id)
    }
    
    const result = await this.repository.markAsRead(id, userId)
    if (!result) {
      throw NotificationErrors.UPDATE_FAILED('Failed to mark as read')
    }

    return result
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.markAllAsReadForUser(userId)
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    const existing = await this.repository.findByIdAndUser(id, userId)
    if (!existing) {
      throw NotificationErrors.NOT_FOUND(id)
    }

    const deleted = await this.repository.delete(id, userId)
    if (!deleted) {
      throw NotificationErrors.DELETE_FAILED('Failed to delete notification')
    }
  }
}
