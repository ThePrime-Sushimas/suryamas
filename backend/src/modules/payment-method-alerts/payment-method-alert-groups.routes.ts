import { Router } from 'express'
import { paymentMethodAlertGroupsController } from './payment-method-alert-groups.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { createAlertGroupSchema, updateAlertGroupSchema, alertGroupIdSchema } from './payment-method-alert-groups.schema'

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('payment_method_alerts'), (req, res) => paymentMethodAlertGroupsController.list(req, res))
router.post('/', canInsert('payment_method_alerts'), validateSchema(createAlertGroupSchema), (req, res) => paymentMethodAlertGroupsController.create(req, res))
router.put('/:id', canUpdate('payment_method_alerts'), validateSchema(updateAlertGroupSchema), (req, res) => paymentMethodAlertGroupsController.update(req, res))
router.delete('/:id', canDelete('payment_method_alerts'), validateSchema(alertGroupIdSchema), (req, res) => paymentMethodAlertGroupsController.delete(req, res))
router.post('/test/:id', canUpdate('payment_method_alerts'), validateSchema(alertGroupIdSchema), (req, res) => paymentMethodAlertGroupsController.test(req, res))

export default router
