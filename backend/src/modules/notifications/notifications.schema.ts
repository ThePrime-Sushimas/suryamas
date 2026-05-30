import { z } from '@/lib/openapi'
import { NOTIFICATION_EVENT_KEYS } from './notification-events'

const uuidSchema = z.string().uuid()

const notificationTypeEnum = z.enum(['info', 'success', 'warning', 'error', 'approval_required'])

const eventKeyEnum = z.enum([
  NOTIFICATION_EVENT_KEYS.PURCHASE_REQUEST_SUBMITTED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_REQUEST_APPROVED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_REQUEST_REJECTED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_SUBMITTED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_APPROVED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_SENT,
  NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_ORDERED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_ORDER_CANCELLED,
  NOTIFICATION_EVENT_KEYS.GOODS_RECEIPT_CONFIRMED,
  NOTIFICATION_EVENT_KEYS.GOODS_PROCESSING_CONFIRMED,
  NOTIFICATION_EVENT_KEYS.GOODS_PROCESSING_REJECTED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_SUBMITTED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_APPROVED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_REJECTED,
  NOTIFICATION_EVENT_KEYS.PURCHASE_INVOICE_POSTED,
  NOTIFICATION_EVENT_KEYS.PRICELIST_APPROVED,
  NOTIFICATION_EVENT_KEYS.JOURNAL_SUBMITTED,
  NOTIFICATION_EVENT_KEYS.JOURNAL_APPROVED,
  NOTIFICATION_EVENT_KEYS.JOURNAL_REJECTED,
  NOTIFICATION_EVENT_KEYS.JOURNAL_POSTED,
  NOTIFICATION_EVENT_KEYS.GENERAL_INVOICE_REQUESTED,
])

export const notificationIdSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
})

export const getNotificationsSchema = z.object({
  query: z
    .object({
      is_read: z.enum(['true', 'false']).optional(),
      limit: z.string().regex(/^\d+$/).transform(Number).optional(),
      offset: z.string().regex(/^\d+$/).transform(Number).optional(),
    })
    .optional(),
})

export const saveNotificationRulesSchema = z.object({
  body: z.object({
    rules: z.array(
      z.object({
        event_key: eventKeyEnum,
        position_id: uuidSchema.nullable(),
        is_active: z.boolean(),
        title_template: z.string().min(1).max(255).optional(),
        message_template: z.string().min(1).optional(),
        type: notificationTypeEnum.optional(),
        redirect_url_template: z.string().max(500).nullable().optional(),
      })
    ),
  }),
})
