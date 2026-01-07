import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { productUomsController } from './product-uoms.controller'
import { PermissionService } from '../../services/permission.service'
import { createProductUomSchema, updateProductUomSchema, productUomIdSchema } from './product-uoms.schema'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('product-uoms', 'Product UOM Management').catch(() => {})

const router = Router({ mergeParams: true })

router.use(authenticate, resolveBranchContext)

router.get('/', canView('product-uoms'), (req, res) => 
  productUomsController.list(req as AuthenticatedRequest, res))

router.post('/', canInsert('product-uoms'), validateSchema(createProductUomSchema), productUomsController.create)

router.put('/:uomId', canUpdate('product-uoms'), validateSchema(updateProductUomSchema), productUomsController.update)

router.delete('/:uomId', canDelete('product-uoms'), validateSchema(productUomIdSchema), (req, res) => 
  productUomsController.delete(req as AuthenticatedRequest, res))

router.post('/:uomId/restore', canUpdate('product-uoms'), validateSchema(productUomIdSchema), productUomsController.restore)

export default router
