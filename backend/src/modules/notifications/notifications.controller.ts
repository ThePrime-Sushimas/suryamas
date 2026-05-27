import { Request, Response } from 'express'
import { NotificationsService } from './notifications.service'
import { notificationRulesService } from './notification-rules.service'
import { sendSuccess } from '../../utils/response.util'
import { handleError } from '../../utils/error-handler.util'
import { AuthenticationError } from '../../utils/errors.base'
import type { ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { notificationIdSchema, getNotificationsSchema, saveNotificationRulesSchema } from './notifications.schema'
import { getWriteScope, requireCompanyAccess } from '../../utils/branch-access.util'

type GetNotificationsReq = ValidatedAuthRequest<typeof getNotificationsSchema>
type NotificationIdReq = ValidatedAuthRequest<typeof notificationIdSchema>
type SaveRulesReq = ValidatedAuthRequest<typeof saveNotificationRulesSchema>

function requireUserId(req: Request): string {
  const userId = req.user?.id
  if (!userId) throw new AuthenticationError()
  return userId
}

async function resolveRulesCompanyId(req: Request): Promise<string> {
  const { companyId: writeCompanyId, companyIds } = await getWriteScope(req)
  const queryCompanyId = req.query.company_id as string | undefined
  if (queryCompanyId) {
    requireCompanyAccess(queryCompanyId, companyIds)
    return queryCompanyId
  }
  return writeCompanyId
}

export class NotificationsController {
  private service = new NotificationsService()

  getNotifications = async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req)
      const validated = (req as GetNotificationsReq).validated
      const isReadParam = validated?.query?.is_read
      const isRead = isReadParam === 'true' ? true : isReadParam === 'false' ? false : undefined
      const limit = validated?.query?.limit ?? 20
      const offset = validated?.query?.offset ?? 0

      const notifications = await this.service.getNotificationsForUser(userId, isRead, limit, offset)
      sendSuccess(res, notifications, 'Notifications retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_notifications' })
    }
  }

  getUnreadCount = async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req)
      const count = await this.service.getUnreadCount(userId)
      sendSuccess(res, { count }, 'Unread count retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_unread_count' })
    }
  }

  markAsRead = async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req)
      const { id } = (req as NotificationIdReq).validated.params
      const result = await this.service.markAsRead(id, userId)
      sendSuccess(res, result, 'Notification marked as read successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'mark_as_read', notificationId: req.params.id })
    }
  }

  markAllAsRead = async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req)
      await this.service.markAllAsRead(userId)
      sendSuccess(res, null, 'All notifications marked as read successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'mark_all_as_read' })
    }
  }

  deleteNotification = async (req: Request, res: Response) => {
    try {
      const userId = requireUserId(req)
      const { id } = (req as NotificationIdReq).validated.params
      await this.service.deleteNotification(id, userId)
      sendSuccess(res, null, 'Notification deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_notification', notificationId: req.params.id })
    }
  }

  getNotificationRules = async (req: Request, res: Response) => {
    try {
      const companyId = await resolveRulesCompanyId(req)
      const catalog = await notificationRulesService.getCatalog(companyId)
      sendSuccess(res, catalog, 'Notification rules retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_notification_rules' })
    }
  }

  saveNotificationRules = async (req: Request, res: Response) => {
    try {
      const companyId = await resolveRulesCompanyId(req)
      const userId = requireUserId(req)
      const { body } = (req as SaveRulesReq).validated
      await notificationRulesService.saveRules(companyId, body.rules, userId)
      const catalog = await notificationRulesService.getCatalog(companyId)
      sendSuccess(res, catalog, 'Notification rules saved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'save_notification_rules' })
    }
  }
}
