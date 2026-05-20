import { logInfo, logWarn } from '../../config/logger'
import { NotificationsService } from './notifications.service'
import { notificationRulesRepository } from './notification-rules.repository'
import { getEventDefinition, renderNotificationTemplate } from './notification-events'
import type { DispatchNotificationContext } from './notification-rules.types'

export class NotificationDispatcherService {
  private readonly notificationsService = new NotificationsService()

  /**
   * Dispatch in-app notifications for a business event.
   * Recipients come from notification_rules (position) + optional additionalRecipientIds.
   */
  async dispatch(
    eventKey: string,
    companyId: string,
    context: DispatchNotificationContext
  ): Promise<void> {
    try {
      const def = getEventDefinition(eventKey)
      const rule = await notificationRulesRepository.findActiveByEvent(companyId, eventKey)

      const variables: Record<string, string | number | null | undefined> = {
        id: context.entityId,
        ...context.variables,
      }

      const exclude = new Set(
        (context.excludeUserIds ?? []).filter((id): id is string => Boolean(id))
      )
      const recipientIds = new Set<string>()

      if (rule?.position_id) {
        const positionUsers = await notificationRulesRepository.findUserIdsByPosition(
          companyId,
          rule.position_id
        )
        for (const uid of positionUsers) {
          if (!exclude.has(uid)) recipientIds.add(uid)
        }
      }

      for (const uid of context.additionalRecipientIds ?? []) {
        if (uid && !exclude.has(uid)) recipientIds.add(uid)
      }

      if (recipientIds.size === 0) {
        logInfo('Notification dispatch skipped: no recipients', { eventKey, companyId })
        return
      }

      const titleTemplate = rule?.title_template ?? def?.default_title_template ?? 'Notifikasi'
      const messageTemplate = rule?.message_template ?? def?.default_message_template ?? ''
      const type = rule?.type ?? def?.default_type ?? 'info'
      const category = rule?.category ?? def?.category ?? 'system'
      const redirectTemplate = rule?.redirect_url_template ?? def?.default_redirect_url_template

      const title = renderNotificationTemplate(titleTemplate, variables)
      const message = renderNotificationTemplate(messageTemplate, variables)
      const redirectUrl = redirectTemplate
        ? renderNotificationTemplate(redirectTemplate, variables)
        : undefined

      await Promise.all(
        [...recipientIds].map((recipientId) =>
          this.notificationsService.createNotification({
            companyId,
            recipientId,
            eventKey,
            title,
            message,
            type,
            category,
            data: {
              redirectUrl,
              eventKey,
              entityId: context.entityId,
            },
          })
        )
      )

      logInfo('Notifications dispatched', {
        eventKey,
        companyId,
        recipientCount: recipientIds.size,
      })
    } catch (err) {
      logWarn('Notification dispatch failed (non-blocking)', {
        eventKey,
        companyId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

export const notificationDispatcher = new NotificationDispatcherService()
