import type { NotificationRow } from './notifications.types'
import type { NotificationEventDefinition } from './notification-events'

export interface NotificationRuleRow {
  id: string
  company_id: string
  event_key: string
  position_id: string | null
  title_template: string
  message_template: string
  type: NotificationRow['type']
  category: NotificationRow['category']
  redirect_url_template: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
  position_name?: string | null
  position_code?: string | null
}

export interface NotificationRuleUpsertDto {
  event_key: string
  position_id: string | null
  is_active: boolean
  title_template?: string
  message_template?: string
  type?: NotificationRow['type']
  redirect_url_template?: string | null
}

export interface NotificationRuleCatalogItem extends NotificationEventDefinition {
  rule: NotificationRuleRow | null
}

export interface DispatchNotificationContext {
  entityId: string
  variables?: Record<string, string | number | null | undefined>
  /** Notify specific users (e.g. PR creator on reject) in addition to position rule */
  additionalRecipientIds?: string[]
  /** Skip notifying the actor who triggered the event */
  excludeUserIds?: string[]
}
