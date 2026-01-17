import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { productUomsController } from './product-uoms.controller'
import { PermissionService } from '../../services/permission.service'
import { createProductUomSchema, updateProductUomSchema, productUomIdSchema } from './product-uoms.schema'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('product_uoms', 'Product UOM Management').catch(() => {})

const router = Router({ mergeParams: true })

router.use(authenticate, resolveBranchContext)

router.get('/', canView('product_uoms'), (req, res) => 
  productUomsController.list(req as AuthenticatedRequest, res))

router.post('/', canInsert('product_uoms'), validateSchema(createProductUomSchema), productUomsController.create)

router.put('/:uomId', canUpdate('product_uoms'), validateSchema(updateProductUomSchema), productUomsController.update)

router.delete('/:uomId', canDelete('product_uoms'), validateSchema(productUomIdSchema), (req, res) => 
  productUomsController.delete(req as AuthenticatedRequest, res))

router.post('/:uomId/restore', canUpdate('product_uoms'), validateSchema(productUomIdSchema), productUomsController.restore)

export default router
