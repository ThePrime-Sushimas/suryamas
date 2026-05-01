import { Router } from 'express'
import { paymentMethodsController } from './payment-methods.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { exportLimiter, createRateLimit, updateRateLimit } from '../../middleware/rateLimiter.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  paymentMethodIdSchema,
  bulkUpdateStatusSchema,
  bulkDeleteSchema,
} from './payment-methods.schema'

PermissionService.registerModule('payment_methods', 'Payment Methods Management').catch(() => {})

const sortFields = ['sort_order', 'code', 'name', 'payment_type', 'is_active', 'created_at']

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('payment_methods'), queryMiddleware({ allowedSortFields: sortFields }), (req, res) => paymentMethodsController.list(req, res))
router.get('/export/token', canView('payment_methods'), exportLimiter, (req, res) => paymentMethodsController.generateExportToken(req, res))
router.get('/export', canView('payment_methods'), exportLimiter, (req, res) => paymentMethodsController.exportData(req, res))
router.get('/options', canView('payment_methods'), (req, res) => paymentMethodsController.getOptions(req, res))
router.post('/bulk/status', canUpdate('payment_methods'), updateRateLimit, validateSchema(bulkUpdateStatusSchema), (req, res) => paymentMethodsController.bulkUpdateStatus(req, res))
router.post('/bulk/delete', canDelete('payment_methods'), updateRateLimit, validateSchema(bulkDeleteSchema), (req, res) => paymentMethodsController.bulkDelete(req, res))
router.post('/', canInsert('payment_methods'), createRateLimit, validateSchema(createPaymentMethodSchema), (req, res) => paymentMethodsController.create(req, res))
router.get('/:id', canView('payment_methods'), validateSchema(paymentMethodIdSchema), (req, res) => paymentMethodsController.getById(req, res))
router.put('/:id', canUpdate('payment_methods'), validateSchema(updatePaymentMethodSchema), (req, res) => paymentMethodsController.update(req, res))
router.delete('/:id', canDelete('payment_methods'), validateSchema(paymentMethodIdSchema), (req, res) => paymentMethodsController.delete(req, res))

export default router
