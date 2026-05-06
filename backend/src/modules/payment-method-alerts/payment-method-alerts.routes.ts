import { Router } from 'express'
import { paymentMethodAlertsController } from './payment-method-alerts.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { createAlertSchema, updateAlertSchema, alertIdSchema } from './payment-method-alerts.schema'

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('payment_method_alerts'), (req, res) => paymentMethodAlertsController.list(req, res))
router.get('/history', canView('payment_method_alerts'), (req, res) => paymentMethodAlertsController.getHistory(req, res))
router.get('/history/:id', canView('payment_method_alerts'), (req, res) => paymentMethodAlertsController.getHistoryById(req, res))
router.post('/', canInsert('payment_method_alerts'), validateSchema(createAlertSchema), (req, res) => paymentMethodAlertsController.create(req, res))
router.put('/:id', canUpdate('payment_method_alerts'), validateSchema(updateAlertSchema), (req, res) => paymentMethodAlertsController.update(req, res))
router.delete('/:id', canDelete('payment_method_alerts'), validateSchema(alertIdSchema), (req, res) => paymentMethodAlertsController.delete(req, res))
router.post('/test/:id', canUpdate('payment_method_alerts'), validateSchema(alertIdSchema), (req, res) => paymentMethodAlertsController.test(req, res))
router.post('/debug/check-alerts', canView('payment_method_alerts'), (req, res) => paymentMethodAlertsController.debugCheckAlerts(req, res))

export default router
