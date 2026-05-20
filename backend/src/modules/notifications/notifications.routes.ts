import { Router } from 'express'
import { NotificationsController } from './notifications.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canUpdate } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import {
  notificationIdSchema,
  getNotificationsSchema,
  saveNotificationRulesSchema,
} from './notifications.schema'
import { PermissionService } from '../../services/permission.service'

const router = Router()
const controller = new NotificationsController()

PermissionService.registerModule('notifications', 'System Notifications').catch((err) => {
  console.error('Failed to register notifications module:', err instanceof Error ? err.message : err)
})

router.use(authenticate, resolveBranchContext)

// Personal inbox — scoped to authenticated user in service layer
router.get('/unread-count', (req, res) => controller.getUnreadCount(req, res))
router.patch('/read-all', (req, res) => controller.markAllAsRead(req, res))
router.get('/', validateSchema(getNotificationsSchema), (req, res) => controller.getNotifications(req, res))
router.patch('/:id/read', validateSchema(notificationIdSchema), (req, res) => controller.markAsRead(req, res))
router.delete('/:id', validateSchema(notificationIdSchema), (req, res) => controller.deleteNotification(req, res))

// Routing rules (admin) — assign position per business event
router.get('/rules', canUpdate('notifications'), (req, res) => controller.getNotificationRules(req, res))
router.put('/rules', canUpdate('notifications'), validateSchema(saveNotificationRulesSchema), (req, res) =>
  controller.saveNotificationRules(req, res)
)

export default router
