import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { purchaseRequestsController } from './purchase-requests.controller'
import {
  createPurchaseRequestSchema, updatePurchaseRequestSchema, purchaseRequestIdSchema,
  approveSchema, rejectSchema, purchaseRequestListSchema, submitForApprovalSchema
} from './purchase-requests.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('purchase_requests', 'Purchase Request Management').catch((err) => {
  console.error('Failed to register purchase_requests module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// Static routes BEFORE /:id
router.get('/search', canView('purchase_requests'), validateSchema(purchaseRequestListSchema), (req, res) => purchaseRequestsController.list(req, res))

// CRUD
router.get('/', canView('purchase_requests'), validateSchema(purchaseRequestListSchema), (req, res) => purchaseRequestsController.list(req, res))
router.post('/', canInsert('purchase_requests'), validateSchema(createPurchaseRequestSchema), (req, res) => purchaseRequestsController.create(req, res))
router.get('/:id', canView('purchase_requests'), validateSchema(purchaseRequestIdSchema), (req, res) => purchaseRequestsController.getById(req, res))
router.put('/:id', canUpdate('purchase_requests'), validateSchema(updatePurchaseRequestSchema), (req, res) => purchaseRequestsController.update(req, res))
router.delete('/:id', canDelete('purchase_requests'), validateSchema(purchaseRequestIdSchema), (req, res) => purchaseRequestsController.delete(req, res))

// Status transitions
router.post('/:id/submit', canUpdate('purchase_requests'), validateSchema(submitForApprovalSchema), (req, res) => purchaseRequestsController.submitForApproval(req, res))
router.post('/:id/approve', canUpdate('purchase_requests'), validateSchema(approveSchema), (req, res) => purchaseRequestsController.approve(req, res))
router.post('/:id/reject', canUpdate('purchase_requests'), validateSchema(rejectSchema), (req, res) => purchaseRequestsController.reject(req, res))
router.post('/:id/cancel', canUpdate('purchase_requests'), validateSchema(purchaseRequestIdSchema), (req, res) => purchaseRequestsController.cancel(req, res))

export default router
