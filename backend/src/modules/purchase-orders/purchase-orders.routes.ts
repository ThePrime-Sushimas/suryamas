import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete, canApprove } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { purchaseOrdersController } from './purchase-orders.controller'
import {
  createPurchaseOrderSchema, updatePurchaseOrderSchema, purchaseOrderIdSchema,
  cancelSchema, purchaseOrderListSchema
} from './purchase-orders.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('purchase_orders', 'Purchase Order Management').catch((err) => {
  console.error('Failed to register purchase_orders module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// CRUD
router.get('/', canView('purchase_orders'), validateSchema(purchaseOrderListSchema), (req, res) => purchaseOrdersController.list(req, res))
router.post('/', canInsert('purchase_orders'), validateSchema(createPurchaseOrderSchema), (req, res) => purchaseOrdersController.create(req, res))
router.get('/:id', canView('purchase_orders'), validateSchema(purchaseOrderIdSchema), (req, res) => purchaseOrdersController.getById(req, res))
router.put('/:id', canUpdate('purchase_orders'), validateSchema(updatePurchaseOrderSchema), (req, res) => purchaseOrdersController.update(req, res))
router.delete('/:id', canDelete('purchase_orders'), validateSchema(purchaseOrderIdSchema), (req, res) => purchaseOrdersController.delete(req, res))

// Status transitions
router.post('/:id/submit', canUpdate('purchase_orders'), validateSchema(purchaseOrderIdSchema), (req, res) => purchaseOrdersController.submitForApproval(req, res))
router.post('/:id/approve', canApprove('purchase_orders'), validateSchema(purchaseOrderIdSchema), (req, res) => purchaseOrdersController.approve(req, res))
router.post('/:id/send', canUpdate('purchase_orders'), validateSchema(purchaseOrderIdSchema), (req, res) => purchaseOrdersController.markSent(req, res))
router.post('/:id/cancel', canUpdate('purchase_orders'), validateSchema(cancelSchema), (req, res) => purchaseOrdersController.cancel(req, res))

export default router
