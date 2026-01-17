import { Router } from 'express'
import { paymentMethodsController } from './payment-methods.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { queryMiddleware } from '../../middleware/query.middleware'
import { exportLimiter, createRateLimit, updateRateLimit } from '../../middleware/rateLimiter.middleware'
import { validateSchema, ValidatedAuthRequest } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { 
  createPaymentMethodSchema, 
  updatePaymentMethodSchema, 
  paymentMethodIdSchema,
  bulkUpdateStatusSchema,
  bulkDeleteSchema
} from './payment-methods.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

// Register module permissions
PermissionService.registerModule('payment_methods', 'Payment Methods Management').catch((error) => {
  console.error('Failed to register payment_methods module:', error.message)
})

const router = Router()

// Apply authentication and branch context to all routes
router.use(authenticate, resolveBranchContext)

// List routes
router.get('/', canView('payment_methods'), queryMiddleware({
  allowedSortFields: ['sort_order', 'code', 'name', 'payment_type', 'is_active', 'created_at'],
}), (req, res) => 
  paymentMethodsController.list(req as AuthenticatedQueryRequest, res))

// Export routes with rate limiting
router.get('/export/token', canView('payment_methods'), exportLimiter, (req, res) => 
  paymentMethodsController.generateExportToken(req as AuthenticatedRequest, res))

router.get('/export', canView('payment_methods'), exportLimiter, (req, res) => 
  paymentMethodsController.exportData(req as AuthenticatedQueryRequest, res))

// Options route for dropdowns
router.get('/options', canView('payment_methods'), (req, res) => 
  paymentMethodsController.getOptions(req as AuthenticatedRequest, res))

// Bulk operations with rate limiting
router.post('/bulk/status', canUpdate('payment_methods'), updateRateLimit, validateSchema(bulkUpdateStatusSchema), (req, res) => 
  paymentMethodsController.bulkUpdateStatus(req as ValidatedAuthRequest<typeof bulkUpdateStatusSchema>, res))

router.post('/bulk/delete', canDelete('payment_methods'), updateRateLimit, validateSchema(bulkDeleteSchema), (req, res) => 
  paymentMethodsController.bulkDelete(req as ValidatedAuthRequest<typeof bulkDeleteSchema>, res))

// CRUD operations
router.post('/', canInsert('payment_methods'), createRateLimit, validateSchema(createPaymentMethodSchema), (req, res) => 
  paymentMethodsController.create(req as ValidatedAuthRequest<typeof createPaymentMethodSchema>, res))

router.get('/:id', canView('payment_methods'), validateSchema(paymentMethodIdSchema), (req, res) => 
  paymentMethodsController.getById(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('payment_methods'), validateSchema(updatePaymentMethodSchema), (req, res) => 
  paymentMethodsController.update(req as ValidatedAuthRequest<typeof updatePaymentMethodSchema>, res))

router.delete('/:id', canDelete('payment_methods'), validateSchema(paymentMethodIdSchema), (req, res) => 
  paymentMethodsController.delete(req as AuthenticatedRequest, res))

export default router

