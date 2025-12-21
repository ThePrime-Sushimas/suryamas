import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { productUomsController } from './product-uoms.controller'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('product-uoms', 'Product UOM Management').catch(() => {})

const router = Router({ mergeParams: true })

// All routes require authentication
router.use(authenticate)

// Get UOMs for product
router.get(
  '/',
  canView('product-uoms'),
  productUomsController.list
)

// Create UOM
router.post(
  '/',
  canInsert('product-uoms'),
  productUomsController.create
)

// Update UOM
router.put(
  '/:uomId',
  canUpdate('product-uoms'),
  productUomsController.update
)

// Delete UOM
router.delete(
  '/:uomId',
  canDelete('product-uoms'),
  productUomsController.delete
)

// Restore UOM
router.post(
  '/:uomId/restore',
  canUpdate('product-uoms'),
  productUomsController.restore
)

export default router
